export const VNOTE_PREFIX = '@formio/mcp:';
export function prefixVnote(note) {
    return `${VNOTE_PREFIX} ${note}`;
}
export const stripRevisions = ({ 
// eslint-disable-next-line @typescript-eslint/no-unused-vars
revisions: _revisions, ...rest }) => rest;
