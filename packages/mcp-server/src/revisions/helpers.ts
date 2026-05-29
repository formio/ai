export const VNOTE_PREFIX = '@formio/mcp:';

export function prefixVnote(note: string): string {
  return `${VNOTE_PREFIX} ${note}`;
}

export const stripRevisions = ({
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  revisions: _revisions,
  ...rest
}: Record<string, unknown>) => rest;
