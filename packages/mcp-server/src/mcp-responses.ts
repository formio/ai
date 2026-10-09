import { toolErrorDetails } from './tool-errors.js';

export function toMcpTextResult(data: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }],
  };
}

/**
 * A successful result carrying both a typed payload and the text a model reads.
 *
 * Tools that declare an outputSchema must return structuredContent — the SDK
 * rejects the call otherwise — and structuredContent must be an object, which is
 * why list tools name their array (`{ forms: [...] }`) rather than returning it
 * bare.
 *
 * `text` defaults to the payload as pretty JSON so the two views agree. Pass it
 * explicitly only where the text is deliberately written for a human, such as a
 * connectivity check or a bare acknowledgement.
 */
export function toMcpStructuredResult(structured: Record<string, unknown>, text?: string) {
  return {
    content: [{ type: 'text' as const, text: text ?? JSON.stringify(structured, null, 2) }],
    structuredContent: structured,
  };
}

// Where the structured half of an error travels. Not structuredContent: MCP clients
// validate structuredContent against the tool's (success) outputSchema even when
// isError is set, so an error payload there is rejected as a protocol error.
export const ERROR_META_KEY = 'io.form/error';

// `[CODE]` leads the text so a client that surfaces only text still shows the code.
// `notes` follow it and lead the message for the same reason a successful answer's
// do: a note is often the CAUSE of the failure being reported — an ignored
// formio.json on the walk, an environment variable a host never expanded — and a
// failure rendered alone hides the first half of the story.
export function toMcpError(error: unknown, notes: readonly string[] = []) {
  const message = error instanceof Error ? error.message : String(error);
  const details = toolErrorDetails(error);
  const text = [...notes, message].filter(Boolean).join('\n');
  return {
    content: [{ type: 'text' as const, text: `[${details.code}] ${text}` }],
    _meta: { [ERROR_META_KEY]: details },
    isError: true,
  };
}
