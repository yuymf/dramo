import type { ImageItem } from "@/lib/models";

export interface Dialogue {
  speaker?: string;
  text: string;
  type?: "dialogue" | "narration";
}

export interface FramePrompts {
  textToImage?: string;
  imageGuided?: string;
  textToVideo?: string;
}

export interface FrameData {
  id: string;
  order: number;
  title: string;
  sceneType?: "INT." | "EXT.";
  timeOfDay?: "日" | "夜";
  description: string;
  bulletPoints: string[];
  image?: ImageItem;
  shot_number?: string;
  shot_size?: string;
  duration_seconds?: number;
  scene_description?: string;
  director_notes?: string;
  audio_description?: string;
  camera_angle?: string;
  camera_movement?: string;
  focal_length?: string;
  style?: string;
  referenceImages?: string[];
  referencePaths?: string[];
  characters?: string[];
  locations?: string[];
  dialogues?: Dialogue[];
  prompts?: FramePrompts;
}
