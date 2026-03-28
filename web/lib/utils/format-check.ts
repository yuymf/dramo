/**
 * Format validation utilities
 * Check for required markers, role indicators, and structural integrity
 */
import type { Script } from "@/lib/models";

export interface ValidationError {
  type: "error" | "warning";
  sceneId?: string;
  blockIndex?: number;
  message: string;
}

/**
 * Validate script format and structure
 */
export function validateScript(script: Script): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!script.title || script.title.trim() === "") {
    errors.push({
      type: "error",
      message: "Script title is required",
    });
  }

  if (!script.scenes || script.scenes.length === 0) {
    errors.push({
      type: "error",
      message: "Script must have at least one scene",
    });
    return errors;
  }

  script.scenes.forEach((scene) => {
    if (!scene.title || scene.title.trim() === "") {
      errors.push({
        type: "error",
        sceneId: scene.id,
        message: `Scene ${scene.order} is missing a title`,
      });
    }

    if (!scene.content || scene.content.length === 0) {
      errors.push({
        type: "warning",
        sceneId: scene.id,
        message: `Scene "${scene.title}" has no content`,
      });
    }

    scene.content.forEach((block, idx) => {
      // Note: Block interface doesn't have a type property, so skipping type validation

      if (!block.text || block.text.trim() === "") {
        errors.push({
          type: "error",
          sceneId: scene.id,
          blockIndex: idx,
          message: `Block ${idx + 1} has empty text`,
        });
      }
    });
  });

  return errors;
}

/**
 * Check for persona taboo words (mock implementation)
 */
export function checkTabooWords(
  text: string,
  tabooWords: string[]
): string[] {
  const found: string[] = [];
  tabooWords.forEach((word) => {
    if (text.includes(word)) {
      found.push(word);
    }
  });
  return found;
}

