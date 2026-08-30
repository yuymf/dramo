export type ScriptForm = 'linear' | 'branching' | 'storyboard';

export type ContentType = 'live' | 'film' | 'short_drama' | 'short_video' | 'vlog';

export type ScriptStyle =
  | 'humorous'
  | 'bizarre'
  | 'healing'
  | 'passionate'
  | 'sad'
  | 'suspense'
  | 'horror'
  | 'absurd'
  | 'realistic'
  | 'retro'
  | 'acg'
  | 'literary';

export type ScriptGoal = 'chitchat' | 'gaming' | 'discussion' | 'education' | 'commerce' | string;

export interface Block {
  id: string;
  label: string;
  text: string;
}

export interface Scene {
  id: string;
  title: string;
  description?: string;
  isEXT?: boolean;
  isDay?: boolean;
  order: number;
  content: Block[];
}

export interface Act {
  id: string;
  name: string;
  order: number;
  sceneIds: string[];
}

export interface Script {
  id: string;
  projectId: string;
  title: string;
  topic?: string;
  form: ScriptForm;
  contentType: ContentType;
  styles: ScriptStyle[];
  goal?: ScriptGoal;
  status: 'draft' | 'published' | 'archived';
  acts: Act[];
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

export type PolishOperation = 'adjust_style' | 'simplify' | 'expand' | 'rewrite';

export interface PolishRequest {
  text: string;
  operation?: PolishOperation;
  styles?: ScriptStyle[];
  characterId?: string;
  instruction?: string;
}

export interface PolishResponse {
  original: string;
  polished: string;
  explanation: string;
}

export interface ImageItem {
  id: string;
  url: string;
  width?: number;
  height?: number;
  source: 'upload' | 'generated' | 'reference';
  createdAt: string;
}

export interface CharacterImageAsset {
  id: string;
  name: string;
  description?: string;
  alias?: string;
  images: ImageItem[];
  createdAt: string;
}

export interface LocationImageAsset {
  id: string;
  name: string;
  description?: string;
  alias?: string;
  images: ImageItem[];
  createdAt: string;
}

export interface ScriptVersion {
  id: string;
  scriptId: string;
  version: number;
  summary: string;
  author?: string;
  createdAt: string;
  content: Script;
}

export interface Dialogue {
  speaker?: string;
  text: string;
  type?: 'dialogue' | 'narration';
}

export interface ShotPrompts {
  textToImage?: string;
  imageGuided?: string;
  textToVideo?: string;
}

export interface Shot {
  shot_number: string;
  shot_size: string;
  duration_seconds: number;
  scene_description: string;
  director_notes: string;
  audio_description: string;
  camera_angle: string;
  camera_movement: string;
  focal_length: string;
  characters?: string[];
  locations?: string[];
  dialogues?: Dialogue[];
  prompts?: ShotPrompts;
}

export interface StoryboardScene {
  id: string;
  title: string;
  summary: string;
  shots: Shot[];
}

export interface StoryboardResponse {
  projectId: string;
  scenes: StoryboardScene[];
}
