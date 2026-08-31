export const CINEMA_ASPECT_RATIOS = ["16:9", "9:16", "2.39:1", "4:3"] as const;
export type CinemaAspectRatio = (typeof CINEMA_ASPECT_RATIOS)[number];

export type ReelStage = "scene" | "performance" | "text_storyboard" | "storyboard_images" | "film";
export type CinemaAssistTarget = "scene" | "performance" | "shots";

export interface CinemaSettings {
  aspectRatio: CinemaAspectRatio;
  productionKind: string;
  cameraStyle: string;
  artStyle: string;
}

export const DEFAULT_CINEMA_SETTINGS: CinemaSettings = {
  aspectRatio: "16:9",
  productionKind: "短片",
  cameraStyle: "",
  artStyle: "",
};

export interface ReelShot {
  id?: string;
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

export interface ReelDoc {
  id: string;
  episodeId: string;
  name: string;
  sortOrder: number;
  sceneText: string;
  performance: string;
  shots: ReelShot[];
  images: ReelImage[];
  lastFrameUrl: string | null;
  previousReelId: string | null;
  films: ReelFilmRecord[];
  stage: ReelStage;
  parsed: { characters: string[]; props: string[]; quotes: string[] };
}

export const STAGE_LABEL: Record<ReelStage, string> = {
  scene: "场景",
  performance: "表演",
  text_storyboard: "文字分镜",
  storyboard_images: "分镜图",
  film: "成片",
};
