import type { ChatMessageOptions, StructuredRequirements } from '@/lib/types/chat';

/**
 * Last-mile defense: if a message's `content` is raw JSON that was supposed to be
 * parsed into structured fields (options, clarificationComplete), extract the text
 * and recover the structured data.
 *
 * This covers ALL backend leak paths — no matter how AgentOS formats its response
 * or how the SSE parsing chain handles it, the user never sees raw JSON.
 */

interface MessageFields {
  content: string;
  options?: ChatMessageOptions;
  clarificationComplete?: StructuredRequirements;
}

export function sanitizeMessage(msg: MessageFields): MessageFields {
  const content = msg.content;

  // Fast path: not JSON → nothing to do
  if (!content || !content.trimStart().startsWith('{')) {
    return msg;
  }

  // Already has structured fields extracted → content is real text
  if (msg.options || msg.clarificationComplete) {
    return msg;
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(content);
  } catch {
    // LLM often emits JSON with real newlines — sanitize and retry
    try {
      const sanitized = content
        .replace(/\r\n/g, '\\n')
        .replace(/\r/g, '\\n')
        .replace(/\n/g, '\\n')
        .replace(/\t/g, '\\t');
      parsed = JSON.parse(sanitized);
    } catch {
      // Not valid JSON even after sanitization → it's real content, leave it
      return msg;
    }
  }

  // Must look like a structured agent response (has a "content" key that's a string)
  if (typeof parsed.content !== 'string') {
    return msg;
  }

  const result: MessageFields = {
    content: parsed.content,
  };

  // Recover options
  if (
    parsed.options &&
    typeof parsed.options === 'object' &&
    Array.isArray((parsed.options as Record<string, unknown>).items)
  ) {
    result.options = parsed.options as ChatMessageOptions;
  }

  // Recover clarificationComplete
  if (
    parsed.clarificationComplete &&
    typeof parsed.clarificationComplete === 'object'
  ) {
    result.clarificationComplete = parsed.clarificationComplete as StructuredRequirements;
  }

  return result;
}
