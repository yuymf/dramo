/**
 * Unwrap AgentOS workflow JSON. Results often arrive as
 * `{ content: "{...}" }` or `{ output: "{...}" }`.
 */
export function unwrapWorkflowJson(raw: unknown): Record<string, unknown> {
  if (typeof raw === 'object' && raw !== null) {
    const obj = raw as Record<string, unknown>;
    const inner = obj.content ?? obj.output ?? obj;
    if (typeof inner === 'string') {
      try {
        return JSON.parse(inner) as Record<string, unknown>;
      } catch {
        return obj;
      }
    }
    if (typeof inner === 'object' && inner !== null) {
      return inner as Record<string, unknown>;
    }
  }
  return {};
}
