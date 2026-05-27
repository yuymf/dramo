import type { ContentType } from '@/lib/models';

/** A single option card shown in the chat */
export interface OptionCard {
  id: string;
  label: string;        // Short title, 2-4 chars
  icon?: string;         // Emoji
  description?: string;  // 1-2 sentence explanation
}

/** Options attached to an assistant message */
export interface ChatMessageOptions {
  multiSelect: boolean;
  items: OptionCard[];          // At least 3, AI-generated dynamically
  customInput: true;            // Always allow free input, renders as "我有别的想法..."
  skipAction?: {
    label: string;
    icon: string;
  };
}

/** Structured requirements output from clarification */
export interface StructuredRequirements {
  contentType: ContentType;
  styles: string[];
  goal: string;
  keyword: string;
  topic?: string;
  situation?: string;
  hotStuffs?: string;
  extraRequirements?: string;
}

/** Extended ChatMessage with new fields */
export interface ExtendedChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  blocks?: Array<{ label: string; text: string }>;
  messageType?: 'text' | 'options' | 'progress' | 'confirm_script';
  options?: ChatMessageOptions;
  selectedOption?: string[] | string;  // What the user picked
  clarificationComplete?: StructuredRequirements;
  createdAt: string;
}

/** Pipeline task step */
export type PipelineStep = 'clarification' | 'script' | 'characters' | 'locations' | 'storyboard';

/** Pipeline task status */
export type PipelineTaskStatus = 'pending' | 'in_progress' | 'completed' | 'paused' | 'failed' | 'skipped';

/** A single task in the pipeline */
export interface PipelineTask {
  id: string;
  step: PipelineStep;
  label: string;
  status: PipelineTaskStatus;
}
