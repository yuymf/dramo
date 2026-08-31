import type { IncomingMessage, Server } from 'node:http';
import { WebSocketServer, WebSocket } from 'ws';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { prisma } from './db';
import { logger } from './logger';
import { SESSION_COOKIE } from '../middleware/session';
import { resolveAccess } from '../services/access.service';
import { applyCrdt, encodeCrdt, yDocToNodes } from './crdt';
import type { ScreenplayNode } from '../types/screenplay';
import { deriveFromNodes } from '../services/derive.service';

const MSG_SYNC = 0;
const MSG_AWARENESS = 1;

interface Room {
  doc: Y.Doc;
  awareness: awarenessProtocol.Awareness;
  clients: Set<WebSocket>;
  episodeId: string;
  projectId: string;
  persistTimer: ReturnType<typeof setTimeout> | null;
}

const rooms = new Map<string, Room>();

export function attachCollabWs(httpServer: Server) {
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (req, socket, head) => {
    const url = req.url ?? '';
    if (!url.startsWith('/collab/')) {
      return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => {
      wss.emit('connection', ws, req);
    });
  });

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    void handleConnection(ws, req).catch((err) => {
      logger.error({ err }, 'collab ws handshake failed');
      ws.close();
    });
  });
}

async function handleConnection(ws: WebSocket, req: IncomingMessage) {
  const token = readCookie(req, SESSION_COOKIE);
  if (!token) {
    ws.close(4001, '未登录');
    return;
  }
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true } } },
  });
  if (!session || session.expiresAt <= new Date()) {
    ws.close(4001, '未登录');
    return;
  }

  const match = (req.url ?? '').match(/^\/collab\/episode\/([^/?]+)/);
  const episodeId = match?.[1];
  if (!episodeId) {
    ws.close(4002, '房间无效');
    return;
  }
  const episode = await prisma.episode.findUnique({
    where: { id: episodeId },
    include: { screenplay: true },
  });
  if (!episode) {
    ws.close(4004, '集不存在');
    return;
  }
  const access = await resolveAccess(episode.projectId, session.user.id);
  const writable = access.role === 'OWNER' || access.role === 'ADMIN' || access.role === 'EDITOR';

  const room = await loadRoom(episodeId, episode.projectId, episode.screenplay?.crdt ?? '');
  room.clients.add(ws);

  const awareness = room.awareness;
  sendSyncStep1(ws, room.doc);

  ws.on('message', (data) => {
    const buf = Buffer.isBuffer(data) ? data : Buffer.from(data as ArrayBuffer);
    const decoder = decoding.createDecoder(buf);
    const msgType = decoding.readVarUint(decoder);
    if (msgType === MSG_SYNC) {
      const encoder = encoding.createEncoder();
      encoding.writeVarUint(encoder, MSG_SYNC);
      const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, room.doc, ws);
      if (encoding.length(encoder) > 1) {
        send(ws, encoding.toUint8Array(encoder));
      }
      if (syncMessageType === syncProtocol.messageYjsUpdate && !writable) {
        return;
      }
      if (writable) schedulePersist(room);
    } else if (msgType === MSG_AWARENESS) {
      awarenessProtocol.applyAwarenessUpdate(
        awareness,
        decoding.readVarUint8Array(decoder),
        ws
      );
    }
  });

  ws.on('close', () => {
    room.clients.delete(ws);
    awarenessProtocol.removeAwarenessStates(
      awareness,
      [...awareness.getStates().keys()].filter((client) => {
        const state = awareness.getStates().get(client) as { ws?: WebSocket } | undefined;
        return state?.ws === ws;
      }),
      null
    );
  });
}

async function loadRoom(episodeId: string, projectId: string, crdt: string): Promise<Room> {
  const existing = rooms.get(episodeId);
  if (existing) return existing;
  const doc = new Y.Doc();
  applyCrdt(doc, crdt);
  const awareness = new awarenessProtocol.Awareness(doc);
  const room: Room = {
    doc,
    awareness,
    clients: new Set(),
    episodeId,
    projectId,
    persistTimer: null,
  };
  doc.on('update', (update: Uint8Array, origin: unknown) => {
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_SYNC);
    syncProtocol.writeUpdate(encoder, update);
    const payload = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client !== origin && client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  });
  awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
    const changed = added.concat(updated, removed);
    const update = awarenessProtocol.encodeAwarenessUpdate(awareness, changed);
    const encoder = encoding.createEncoder();
    encoding.writeVarUint(encoder, MSG_AWARENESS);
    encoding.writeVarUint8Array(encoder, update);
    const payload = encoding.toUint8Array(encoder);
    for (const client of room.clients) {
      if (client.readyState === WebSocket.OPEN) client.send(payload);
    }
  });
  rooms.set(episodeId, room);
  return room;
}

function schedulePersist(room: Room) {
  if (room.persistTimer) clearTimeout(room.persistTimer);
  room.persistTimer = setTimeout(() => {
    void persistRoom(room);
  }, 400);
}

async function persistRoom(room: Room) {
  const crdt = encodeCrdt(room.doc);
  const nodes = yDocToNodes(room.doc);
  await prisma.screenplay.updateMany({
    where: { episodeId: room.episodeId },
    data: { crdt, nodes: nodes as object[] },
  });
  if (nodes.length > 0) {
    await deriveFromNodes(room.projectId, nodes as ScreenplayNode[], room.episodeId);
  }
}

function sendSyncStep1(ws: WebSocket, doc: Y.Doc) {
  const encoder = encoding.createEncoder();
  encoding.writeVarUint(encoder, MSG_SYNC);
  syncProtocol.writeSyncStep1(encoder, doc);
  send(ws, encoding.toUint8Array(encoder));
}

function send(ws: WebSocket, data: Uint8Array) {
  if (ws.readyState === WebSocket.OPEN) ws.send(data);
}

function readCookie(req: IncomingMessage, name: string): string | null {
  const raw = req.headers.cookie ?? '';
  const parts = raw.split(';');
  for (const part of parts) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return null;
}
