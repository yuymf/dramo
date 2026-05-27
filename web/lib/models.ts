// Script forms (按剧本呈现与结构逻辑)
export type ScriptForm = 'linear' | 'branching' | 'storyboard';

// Content types (按载体与时长/叙事规模)
export type ContentType = 'live' | 'film' | 'short_drama' | 'short_video' | 'vlog';

// Styles (按情感基调与创作手法，可复选)
export type ScriptStyle = 
  | 'humorous'      // 幽默
  | 'bizarre'       // 猎奇
  | 'healing'       // 治愈
  | 'passionate'    // 热血
  | 'sad'          // 伤感
  | 'suspense'     // 悬疑
  | 'horror'       // 惊悚
  | 'absurd'       // 荒诞
  | 'realistic'    // 写实
  | 'retro'        // 复古
  | 'acg'          // 二次元
  | 'literary';    // 文艺

// Goals (按创作目的与功能)
export type ScriptGoal = 'chitchat' | 'gaming' | 'discussion' | 'education' | 'commerce' | string;

// Legacy types (deprecated, kept for migration)
export type ScriptType = 'product' | 'game' | 'talk' | 'interview' | 'custom';

export interface Block {
  id: string;
  label: string;
  text: string; // HTML content
}

export interface Scene {
  id: string;
  title: string;
  description?: string;
  isEXT?: boolean; // 是否室外场景
  isDay?: boolean; // 是否日间
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
  topic?: string; // 主题/标题
  form: ScriptForm;
  contentType: ContentType;
  styles: ScriptStyle[]; // 复选风格
  goal?: ScriptGoal;
  status: 'draft' | 'published' | 'archived';
  acts: Act[];
  scenes: Scene[];
  createdAt: string;
  updatedAt: string;
}

// Script creation inputs
export interface StructuredScriptInput {
  source: 'structured';
  form: ScriptForm;
  contentType: ContentType;
  styles?: ScriptStyle[];
  goal?: ScriptGoal;
  keyword?: string;
  target?: string;
  topic?: string;
  situation?: string;
  hot_stuffs?: string;
}

export interface RawTextScriptInput {
  source: 'raw_text';
  form: ScriptForm;
  contentType?: ContentType;
  rawText?: string;
  fileId?: string;
}

export type ScriptCreateInput = StructuredScriptInput | RawTextScriptInput;

// Character (formerly Persona)
export interface Character {
  id: string;
  name: string;
  styleTags: string[];
  speechFeatures: {
    catchphrases: string[];
    tabooWords: string[];
    sentencePatterns?: string;
  };
}

// Inspiration
export type InspirationCategory = 'quotes' | 'topics' | 'interactions' | 'hotspots';

export interface Inspiration {
  id: string;
  text: string;
  category: InspirationCategory;
  relevance: number; // 0-1
  source: string;
}

// Polish operations
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

// Chat message
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  blocks?: Array<{ label: string; text: string }>;
  createdAt: string;
}

// Asset generation
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
  characterName: string;
  description?: string;
  alias?: string;
  images: ImageItem[];
  createdAt: string;
}

export interface LocationImageAssetV2 {
  id: string;
  locationName: string;
  description?: string;
  alias?: string;
  images: ImageItem[];
  createdAt: string;
}

// Legacy types (for backward compatibility)
export interface Character3ViewAsset {
  id: string;
  characterName: string;
  assets: {
    front: string;
    side: string;
    back: string;
  };
  createdAt: string;
}

export interface LocationImageAsset {
  id: string;
  locationName: string;
  assets: {
    image: string;
  };
  createdAt: string;
}

// Character relationships
export interface CharacterRelationEdge {
  id: string;
  sourceId: string;
  targetId: string;
  label?: string;
  type?: 'family' | 'friend' | 'colleague' | 'rival' | 'lover' | 'other';
}

export interface CharacterRelationGraph {
  id: string;
  projectId: string;
  nodes: Array<{ id: string; characterId: string; x: number; y: number }>;
  edges: CharacterRelationEdge[];
  updatedAt: string;
}

// Script version history
export interface ScriptVersion {
  id: string;
  scriptId: string;
  version: number;
  summary: string;
  author?: string;
  createdAt: string;
  content: Script;
}

// Storyboard types
export interface Dialogue {
  speaker?: string; // Speaker name or "旁白" for narration
  text: string;
  type?: 'dialogue' | 'narration'; // why: disambiguate narration vs spoken
}

export interface ShotPrompts {
  textToImage?: string; // Text-to-image prompt (from AgentOS)
  imageGuided?: string; // Image-guided prompt (derived on frontend, persisted)
  textToVideo?: string; // Text-to-video prompt (from AgentOS)
}

export interface Shot {
  shot_number: string;        // 镜头编号
  shot_size: string;          // 景别
  duration_seconds: number;   // 时长（秒）
  scene_description: string;  // 画面描述
  director_notes: string;     // 导演提示
  audio_description: string;  // 音频描述
  camera_angle: string;       // 机位角度
  camera_movement: string;    // 运镜方式
  focal_length: string;       // 焦距
  // New enrichment fields (why: enrich shot semantics)
  characters?: string[];      // Character names in this shot
  locations?: string[];       // Location names in this shot
  dialogues?: Dialogue[];     // Dialogues and narration
  prompts?: ShotPrompts;      // Generation prompts
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

// Re-export extended chat types
export type {
  OptionCard,
  ChatMessageOptions,
  StructuredRequirements,
  ExtendedChatMessage,
  PipelineStep,
  PipelineTaskStatus,
  PipelineTask,
} from '@/lib/types/chat';
