import * as Y from 'yjs';
import type { ScreenplayNode } from '../types/screenplay';

export function nodesToYDoc(nodes: ScreenplayNode[]): Y.Doc {
  const doc = new Y.Doc();
  const array = doc.getArray<Y.Map<string>>('nodes');
  doc.transact(() => {
    for (const node of nodes) {
      const map = new Y.Map<string>();
      map.set('id', node.id);
      map.set('type', node.type);
      map.set('text', node.text);
      array.push([map]);
    }
  });
  return doc;
}

export function yDocToNodes(doc: Y.Doc): ScreenplayNode[] {
  const array = doc.getArray<Y.Map<string>>('nodes');
  const nodes: ScreenplayNode[] = [];
  array.forEach((map) => {
    const id = String(map.get('id') ?? '');
    const type = String(map.get('type') ?? 'action');
    const text = String(map.get('text') ?? '');
    if (id) nodes.push({ id, type: type as ScreenplayNode['type'], text });
  });
  return nodes;
}

export function encodeCrdt(doc: Y.Doc): string {
  return Buffer.from(Y.encodeStateAsUpdate(doc)).toString('base64');
}

export function applyCrdt(doc: Y.Doc, crdt: string): void {
  if (!crdt) return;
  Y.applyUpdate(doc, Buffer.from(crdt, 'base64'));
}

export function mergeNodesIntoCrdt(crdt: string, nodes: ScreenplayNode[]): string {
  const doc = new Y.Doc();
  applyCrdt(doc, crdt);
  const current = yDocToNodes(doc);
  const same =
    current.length === nodes.length &&
    current.every((node, i) => node.id === nodes[i].id && node.type === nodes[i].type && node.text === nodes[i].text);
  if (same) return crdt || encodeCrdt(doc);
  const next = nodesToYDoc(nodes);
  return encodeCrdt(next);
}
