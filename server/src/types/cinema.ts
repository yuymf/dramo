export const CINEMA_ASPECT_RATIOS = ['16:9', '9:16', '2.39:1', '4:3'] as const;
export type CinemaAspectRatio = (typeof CINEMA_ASPECT_RATIOS)[number];

export const REEL_STAGES = [
  'scene',
  'performance',
  'text_storyboard',
  'storyboard_images',
  'film',
] as const;
export type ReelStage = (typeof REEL_STAGES)[number];

export const CINEMA_ASSIST_TARGETS = ['scene', 'performance', 'shots'] as const;
export type CinemaAssistTarget = (typeof CINEMA_ASSIST_TARGETS)[number];

export const FILM_DURATION_SEC = 15;

export const NO_PERFORMANCE_MESSAGE = '没有表演不能出文字分镜';
export const NO_SHOTS_MESSAGE = '没有镜头不能出分镜图';
export const NO_IMAGES_MESSAGE = '没有分镜图不能出成片';
export const NOT_CINEMA_MESSAGE = '这不是制片项目';

export interface CinemaSettings {
  aspectRatio: CinemaAspectRatio;
  productionKind: string;
  cameraStyle: string;
  artStyle: string;
}

export const DEFAULT_CINEMA_SETTINGS: CinemaSettings = {
  aspectRatio: '16:9',
  productionKind: '短片',
  cameraStyle: '',
  artStyle: '',
};

export interface ReelShot {
  id: string;
  description: string;
  camera: string;
}

export interface ReelImage {
  shotId: string;
  url: string;
  taskId?: string;
}

export interface ReelFilmRecord {
  id: string;
  url: string;
  durationSec: number;
  createdAt: string;
}

export interface PerformanceParse {
  characters: string[];
  props: string[];
  quotes: string[];
}

const AT_CHAR = /@([^\s@#"'「」『』“”，。！？,.!?;；：:]{1,32})/g;
const QUOTE = /[“"]([^”"]+)[”"]|「([^」]+)」|『([^』]+)』/g;

export function parseCinemaCharacters(text: string): string[] {
  const names: string[] = [];
  const seen = new Set<string>();
  AT_CHAR.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = AT_CHAR.exec(text)) !== null) {
    const name = match[1].trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    names.push(name);
  }
  return names;
}

export function parseCinemaQuotes(text: string): string[] {
  const quotes: string[] = [];
  QUOTE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = QUOTE.exec(text)) !== null) {
    const value = (match[1] ?? match[2] ?? match[3] ?? '').trim();
    if (value) quotes.push(value);
  }
  return quotes;
}

const PROP_MENTION = /#([^\s#，。！？,.!?;；：:]{1,32})/g;

export function parseCinemaProps(text: string): string[] {
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

export function parsePerformance(text: string): PerformanceParse {
  return {
    characters: parseCinemaCharacters(text),
    props: parseCinemaProps(text),
    quotes: parseCinemaQuotes(text),
  };
}

export function hasPerformance(text: string): boolean {
  if (text.trim().length < 2) return false;
  const parsed = parsePerformance(text);
  return parsed.characters.length > 0 || parsed.quotes.length > 0;
}

export function deriveReelStage(input: {
  performance: string;
  shots: ReelShot[];
  images: ReelImage[];
  films: ReelFilmRecord[];
}): ReelStage {
  if (input.films.length > 0) return 'film';
  if (input.images.length > 0) return 'storyboard_images';
  if (input.shots.length > 0) return 'text_storyboard';
  if (hasPerformance(input.performance)) return 'performance';
  return 'scene';
}

export function isCinemaAspectRatio(value: unknown): value is CinemaAspectRatio {
  return typeof value === 'string' && (CINEMA_ASPECT_RATIOS as readonly string[]).includes(value);
}

export function normalizeCinemaSettings(raw: unknown): CinemaSettings {
  const obj = raw && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return {
    aspectRatio: isCinemaAspectRatio(obj.aspectRatio) ? obj.aspectRatio : DEFAULT_CINEMA_SETTINGS.aspectRatio,
    productionKind:
      typeof obj.productionKind === 'string' && obj.productionKind.trim()
        ? obj.productionKind.trim()
        : DEFAULT_CINEMA_SETTINGS.productionKind,
    cameraStyle: typeof obj.cameraStyle === 'string' ? obj.cameraStyle : '',
    artStyle: typeof obj.artStyle === 'string' ? obj.artStyle : '',
  };
}

export function placeholderStoryboardShots(sceneText: string, performance: string): ReelShot[] {
  const parsed = parsePerformance(performance);
  const shots: ReelShot[] = [];
  const scene = sceneText.trim();
  if (scene) {
    shots.push({
      id: crypto.randomUUID(),
      description: scene.slice(0, 120),
      camera: '全景',
    });
  }
  for (const quote of parsed.quotes) {
    if (shots.length >= 6) break;
    shots.push({
      id: crypto.randomUUID(),
      description: quote.slice(0, 120),
      camera: '近景',
    });
  }
  if (shots.length === 0) {
    shots.push({
      id: crypto.randomUUID(),
      description: performance.trim().slice(0, 120),
      camera: '中景',
    });
  }
  return shots.slice(0, 6);
}
