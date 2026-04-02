/**
 * Robust parser for AgentOS workflow responses.
 *
 * AgentOS can return responses in several formats:
 *   1. `{ content: "{...}" }` — double-encoded JSON string
 *   2. `{ output: "{...}" }` — alternative wrapper key
 *   3. ``` ```json { ... } ``` ``` — markdown code-block wrapped
 *   4. Plain string — direct text response
 *   5. Deeply nested `{ content: "{ \"content\": \"...\", \"options\": ... }" }`
 *
 * This module normalises all variants into a consistent shape.
 */

import { logger } from './logger';

const MAX_UNWRAP_DEPTH = 5;
const EMPTY_RESPONSE_FALLBACK = 'No response';

export interface ParsedAgentResponse {
  content: string;
  options?: AgentResponseOptions;
  clarificationComplete?: Record<string, unknown>;
}

interface AgentResponseOptions {
  multiSelect?: boolean;
  items: Array<{ id: string; label: string; icon?: string; description?: string }>;
  customInput?: boolean;
  skipAction?: { label: string; icon: string };
}

/**
 * Strip markdown code-block fences from a string if present.
 * Handles ```json ... ``` and ``` ... ```
 */
function stripMarkdownCodeBlock(text: string): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^```(?:json)?\s*\n?([\s\S]*?)\n?\s*```$/);
  return match ? match[1].trim() : trimmed;
}

/**
 * Sanitize a string for JSON parsing.
 * Fixes common LLM output issues: unescaped control characters in string values.
 */
function sanitizeForJSON(text: string): string {
  // Replace real newlines/tabs inside JSON string values with escaped versions.
  // Strategy: try parsing as-is first; only sanitize on failure.
  try {
    JSON.parse(text);
    return text; // Already valid
  } catch {
    // Replace control characters that break JSON: real \n, \r, \t inside strings
    return text
      .replace(/\r\n/g, '\\n')
      .replace(/\r/g, '\\n')
      .replace(/\n/g, '\\n')
      .replace(/\t/g, '\\t');
  }
}

/**
 * Attempt to parse a string as JSON, returning null on failure.
 * Applies sanitization for common LLM formatting issues (unescaped newlines).
 */
function tryParseJSON(text: string): Record<string, unknown> | null {
  try {
    const parsed = JSON.parse(text);
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as Record<string, unknown>;
    }
    return null;
  } catch {
    // Retry with sanitized input (fix unescaped newlines/tabs)
    try {
      const sanitized = sanitizeForJSON(text);
      const parsed = JSON.parse(sanitized);
      if (typeof parsed === 'object' && parsed !== null) {
        return parsed as Record<string, unknown>;
      }
      return null;
    } catch {
      return null;
    }
  }
}

/**
 * Validate that an `options` object has the expected structure.
 * Must have an `items` array with at least one element.
 */
function isValidOptions(value: unknown): value is AgentResponseOptions {
  if (typeof value !== 'object' || value === null) return false;
  const obj = value as Record<string, unknown>;
  return Array.isArray(obj.items) && obj.items.length > 0;
}

/**
 * Recursively unwrap nested JSON strings until we reach a real object
 * or a non-JSON string. Max depth prevents infinite loops.
 */
function unwrapNestedJSON(value: unknown, depth = 0): unknown {
  if (depth > MAX_UNWRAP_DEPTH) return value;
  if (typeof value !== 'string') return value;

  // Strip markdown code blocks first
  const stripped = stripMarkdownCodeBlock(value);
  const parsed = tryParseJSON(stripped);
  if (parsed === null) return value;

  return unwrapNestedJSON(parsed, depth + 1);
}

/**
 * Assemble a ParsedAgentResponse from a parsed object.
 * Validates options and extracts known fields.
 */
function assembleResult(parsed: Record<string, unknown>): ParsedAgentResponse {
  const rawContent = typeof parsed.content === 'string' ? parsed.content : '';
  // Allow empty content when clarificationComplete or options are present —
  // the AI may send no text alongside structured data.
  const hasStructuredData = !!parsed.clarificationComplete || isValidOptions(parsed.options);
  const result: ParsedAgentResponse = {
    content: rawContent || (hasStructuredData ? '' : EMPTY_RESPONSE_FALLBACK),
  };

  if (parsed.options && isValidOptions(parsed.options)) {
    result.options = parsed.options as AgentResponseOptions;
  } else if (parsed.options) {
    logger.warn(
      { options: parsed.options },
      'parseAgentResponse: invalid options structure, ignoring'
    );
  }

  if (parsed.clarificationComplete) {
    result.clarificationComplete = parsed.clarificationComplete as Record<string, unknown>;
  }

  return result;
}

/**
 * Parse a raw AgentOS response string into a structured response.
 *
 * @param raw - The raw response text from AgentOS
 * @returns Parsed response with content, optional options, and optional clarificationComplete
 */
export function parseAgentResponse(raw: string): ParsedAgentResponse {
  if (!raw || !raw.trim()) {
    logger.warn('parseAgentResponse: empty response');
    return { content: EMPTY_RESPONSE_FALLBACK };
  }

  try {
    // Step 1: Try parsing the outer wrapper
    const stripped = stripMarkdownCodeBlock(raw);
    const outer = tryParseJSON(stripped);

    if (!outer) {
      // Not JSON at all — treat the entire string as content
      return { content: raw.trim() };
    }

    // Step 2: Check if outer is already a final-form response
    // (has `content` as plain text, may also have `options` / `clarificationComplete`).
    // This is the typical shape returned by ClarificationWorkflow:
    //   { content: "...", options: {...}, clarificationComplete: null }
    // We must NOT drill into outer.content here, or we lose sibling fields.
    // Note: outer.content may be "" (empty string) when clarificationComplete is set —
    // we still want to use assembleResult to preserve sibling fields.
    if (
      typeof outer.content === 'string' &&
      !outer.output &&
      (!outer.content || !tryParseJSON(stripMarkdownCodeBlock(outer.content)))
    ) {
      return assembleResult(outer);
    }

    // Step 3: Extract the inner payload from known wrapper keys
    // (handles AgentOS wrappers like { output: "{...}" } or double-encoded content)
    const innerRaw = outer.output ?? outer.content ?? outer;

    // Step 4: Recursively unwrap nested JSON strings
    const inner = unwrapNestedJSON(innerRaw);

    // Step 5: Build parsed result from the unwrapped object
    let parsed: Record<string, unknown>;
    if (typeof inner === 'object' && inner !== null) {
      parsed = inner as Record<string, unknown>;
    } else {
      // Final value is a plain string
      return { content: String(inner) };
    }

    // Step 6: If `content` field itself is a stringified JSON with our target keys, unwrap it
    if (typeof parsed.content === 'string') {
      const innerContent = unwrapNestedJSON(parsed.content);
      if (
        typeof innerContent === 'object' &&
        innerContent !== null &&
        (innerContent as Record<string, unknown>).content
      ) {
        parsed = innerContent as Record<string, unknown>;
      }
    }

    // Step 7: Assemble the final response
    return assembleResult(parsed);
  } catch (err) {
    logger.error({ err, rawLength: raw.length }, 'parseAgentResponse: unexpected error');
    return { content: raw.trim() || EMPTY_RESPONSE_FALLBACK };
  }
}
