import { prisma } from '../lib/db';
import type { ScreenplayNode } from '../types/screenplay';

/**
 * Leading slug on a scene heading: INT./EXT./内景/外景 (and INT./EXT. combos).
 * Single 内/外 is not stripped — it can be part of a location name.
 */
const SCENE_PREFIX =
  /^(INT\.?\s*\/\s*EXT\.?|EXT\.?\s*\/\s*INT\.?|INT\.\/EXT\.?|EXT\.\/INT\.?|I\s*\/\s*E\.?|E\s*\/\s*I\.?|INT\.?|EXT\.?|内景|外景)\s*/i;

/**
 * Time-of-day suffix after a dash. Only stripped when a dash separator is present
 * so a location named "DAY ROOM" is kept.
 */
const TIME_SUFFIX =
  /\s*[-–—－]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|AFTERNOON|EVENING|CONTINUOUS|LATER|SAME|SUNRISE|SUNSET|MAGIC HOUR|GOLDEN HOUR|MOMENTS LATER|THE NEXT DAY|NIGHT\/DAY|DAY\/NIGHT|日|夜|晨|昏|黄昏|傍晚|凌晨|清晨|午|下午|上午|深夜|白天|晚上|同时|稍后|连续|日\/夜|夜\/日)\s*$/i;

const MULTI_SPACE = /\s+/g;

export function parseLocationName(text: string): string | null {
  let value = text.trim();
  if (!value) return null;
  value = value.replace(SCENE_PREFIX, '').trim();
  value = value.replace(TIME_SUFFIX, '').trim();
  value = value.replace(MULTI_SPACE, ' ');
  return value || null;
}

/**
 * Character cue: trim, drop parenthetical performance marks
 * (V.O.) / (CONT'D) / （画外音） / etc. Leading @ and trailing colons are ignored.
 */
const PROP_MENTION = /#([^\s#，。！？,.!?;；：:]{1,32})/g;

export function parsePropNames(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  PROP_MENTION.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = PROP_MENTION.exec(text)) !== null) {
    const name = match[1].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function parseCharacterName(text: string): string | null {
  let value = text.trim();
  if (!value) return null;
  value = value.replace(/^@\s*/, '');
  value = value.replace(/\s*[\(（][^)）]*[\)）]\s*/g, ' ');
  value = value.replace(/[:：]\s*$/g, '');
  value = value.replace(MULTI_SPACE, ' ').trim();
  return value || null;
}

/**
 * After a successful nodes persist: upsert Location from scene_heading and
 * Character from character cues. Existing description/images are never overwritten.
 * Phase 1 does not delete entities that disappeared from the text.
 */
export async function deriveFromNodes(
  projectId: string,
  nodes: ScreenplayNode[],
  episodeId?: string
): Promise<void> {
  const locationNames = new Set<string>();
  const characterNames = new Set<string>();
  const propNames = new Set<string>();

  for (const node of nodes) {
    if (node.type === 'scene_heading') {
      const name = parseLocationName(node.text);
      if (name) locationNames.add(name);
    } else if (node.type === 'character') {
      const name = parseCharacterName(node.text);
      if (name) characterNames.add(name);
    }
    for (const name of parsePropNames(node.text)) {
      propNames.add(name);
    }
  }

  const writes: Promise<unknown>[] = [];

  for (const name of locationNames) {
    writes.push(
      prisma.location.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      })
    );
  }

  for (const name of characterNames) {
    writes.push(
      prisma.character.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      })
    );
  }

  for (const name of propNames) {
    writes.push(
      prisma.prop.upsert({
        where: { projectId_name: { projectId, name } },
        create: { projectId, name },
        update: {},
      })
    );
  }

  if (writes.length > 0) {
    await Promise.all(writes);
  }

  if (episodeId) {
    await deriveScenes(episodeId, nodes);
  }
}

export async function deriveScenes(episodeId: string, nodes: ScreenplayNode[]): Promise<void> {
  const headings: Array<{ heading: string; locationName: string | null; sortOrder: number }> = [];
  const seen = new Set<string>();
  for (const node of nodes) {
    if (node.type !== 'scene_heading') continue;
    const heading = node.text.trim();
    if (!heading || seen.has(heading)) continue;
    seen.add(heading);
    headings.push({
      heading,
      locationName: parseLocationName(heading),
      sortOrder: headings.length,
    });
  }

  for (const item of headings) {
    await prisma.scene.upsert({
      where: { episodeId_heading: { episodeId, heading: item.heading } },
      create: {
        episodeId,
        heading: item.heading,
        locationName: item.locationName,
        sortOrder: item.sortOrder,
      },
      update: { locationName: item.locationName, sortOrder: item.sortOrder },
    });
  }

  if (seen.size === 0) return;
  const staleScenes = await prisma.scene.findMany({
    where: { episodeId, heading: { notIn: [...seen] } },
    select: { id: true },
  });
  if (staleScenes.length > 0) {
    await prisma.shot.updateMany({
      where: { sceneId: { in: staleScenes.map((row) => row.id) } },
      data: { stale: true },
    });
  }
}
