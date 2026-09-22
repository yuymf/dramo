export type ScreenplayFormat = "hollywood" | "asian";
export type NodeType =
  | "scene_heading"
  | "action"
  | "character"
  | "dialogue"
  | "parenthetical"
  | "transition"
  | "comment"
  | "subtitle";

export interface ScreenplayNode {
  id: string;
  type: NodeType;
  text: string;
}

export interface Cover {
  title: string;
  author: string;
  contact: string;
  draftDate: string;
}

export interface ScreenplayDoc {
  id: string;
  episodeId: string;
  title: string;
  format: ScreenplayFormat;
  cover: Cover;
  nodes: ScreenplayNode[];
  updatedAt: string;
}

export const EMPTY_COVER: Cover = {
  title: "",
  author: "",
  contact: "",
  draftDate: "",
};

export const NODE_TYPES: NodeType[] = [
  "scene_heading",
  "action",
  "character",
  "dialogue",
  "parenthetical",
  "transition",
  "comment",
  "subtitle",
];
