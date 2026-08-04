/**
 * MCP tool annotations, as presets rather than per-tool literals.
 *
 * Annotations tell a client whether a call is safe to make speculatively, safe to
 * retry, and whether it can change data — the difference between an assistant
 * that asks before overwriting a form and one that just does it. Spelling them
 * out in nineteen tool files would guarantee drift, so each tool picks the preset
 * that matches its verb and supplies only a human-readable title.
 *
 * `openWorldHint` is true wherever the tool talks to a Form.io deployment: the
 * result depends on a system outside this process.
 */

export interface ToolAnnotations {
  title: string;
  readOnlyHint: boolean;
  destructiveHint: boolean;
  idempotentHint: boolean;
  openWorldHint: boolean;
}

/** Reads from Form.io. Repeatable, changes nothing. */
export function reads(title: string): ToolAnnotations {
  return {
    title,
    readOnlyHint: true,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: true,
  };
}

/** Creates something new. Calling twice yields two documents, so not idempotent. */
export function creates(title: string): ToolAnnotations {
  return {
    title,
    readOnlyHint: false,
    destructiveHint: false,
    idempotentHint: false,
    openWorldHint: true,
  };
}

/**
 * Replaces an existing document. Destructive because the prior state is gone —
 * idempotent because sending the same body again lands the same result.
 */
export function overwrites(title: string): ToolAnnotations {
  return {
    title,
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  };
}

/** Removes a document. Idempotent: deleting an already-deleted document is a no-op. */
export function removes(title: string): ToolAnnotations {
  return {
    title,
    readOnlyHint: false,
    destructiveHint: true,
    idempotentHint: true,
    openWorldHint: true,
  };
}

/** Touches nothing outside this process — no Form.io request at all. */
export function local(title: string, readOnly: boolean): ToolAnnotations {
  return {
    title,
    readOnlyHint: readOnly,
    destructiveHint: false,
    idempotentHint: true,
    openWorldHint: false,
  };
}
