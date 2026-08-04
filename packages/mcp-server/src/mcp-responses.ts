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

export function toMcpError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return {
    content: [{ type: 'text' as const, text: message }],
    isError: true,
  };
}
