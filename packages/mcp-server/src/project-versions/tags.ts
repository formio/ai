import { ResolvedFormioConfig } from '../config.js';
import { formioFetch, isMongoId, templateTransferTimeoutMs } from '../formio-client.js';
import { isRecord, ToolError } from '../tool-errors.js';

/**
 * Form.io's version tags, as the tag tools read them.
 *
 * Tags belong to the whole project family — every stage shares them — and each is
 * stored as one main document plus one `chunk` document per form, all carrying the
 * tag's name. Listing and lookups therefore skip chunk documents, and a tag's
 * template is read from the main document, which Form.io returns chunk-merged.
 */

/** Form.io's `tag` on a project nobody has tagged. */
const UNTAGGED = '0.0.0';
const PAGE = 100;

export interface TagSummary {
  tag: string;
  description?: string;
  created?: string;
}

/** A tag as listed, with the id its template is fetched by. */
export interface TagEntry extends TagSummary {
  id?: string;
}

interface TagDocument extends Record<string, unknown> {
  _id?: unknown;
  tag?: unknown;
  chunk?: unknown;
}

// Form.io's tag index applies its own projection (leaving the stored template out),
// so a `select` is not sent: the server would drop it.
async function tagDocuments(
  config: ResolvedFormioConfig,
  filters: Record<string, string>
): Promise<TagDocument[]> {
  const collect = async (skip: number, found: TagDocument[]): Promise<TagDocument[]> => {
    const { data, total } = await formioFetch(
      'tag',
      { ...filters, limit: String(PAGE), skip: String(skip) },
      config,
      { withMeta: true }
    );
    const page = Array.isArray(data) ? data.filter(isRecord) : [];
    const all = [...found, ...page];
    const more = total === undefined ? page.length === PAGE : skip + page.length < total;
    return more ? collect(skip + PAGE, all) : all;
  };
  const documents = await collect(0, []);
  return documents.filter((document) => document.chunk !== true);
}

function entryOf(document: TagDocument): TagEntry | undefined {
  if (typeof document.tag !== 'string') {
    return undefined;
  }
  return {
    tag: document.tag,
    ...(typeof document.description === 'string' ? { description: document.description } : {}),
    ...(typeof document.created === 'string' ? { created: document.created } : {}),
    ...(typeof document._id === 'string' ? { id: document._id } : {}),
  };
}

/** Every tag of the project's family, newest first, with the ids their templates use. */
export async function listTagEntries(config: ResolvedFormioConfig): Promise<TagEntry[]> {
  const documents = await tagDocuments(config, { sort: '-created' });
  return documents.flatMap((document) => {
    const entry = entryOf(document);
    return entry ? [entry] : [];
  });
}

/** A tag as the tools report it: no id, no template. */
export const summaryOf = ({ tag, description, created }: TagEntry): TagSummary => ({
  tag,
  ...(description !== undefined ? { description } : {}),
  ...(created !== undefined ? { created } : {}),
});

/** The project's `tag` as Form.io reports it, untagged or not. */
export async function readCurrentTag(config: ResolvedFormioConfig): Promise<string | undefined> {
  const reply = await formioFetch('tag/current', {}, config);
  return isRecord(reply) && typeof reply.tag === 'string' ? reply.tag : undefined;
}

/**
 * The tag the project is at, or undefined when it has never been tagged: Form.io
 * reports `0.0.0` for a project with no version, unless a tag of that name exists.
 */
export function currentVersion(
  reported: string | undefined,
  tags: TagSummary[]
): string | undefined {
  if (!reported || (reported === UNTAGGED && !tags.some((summary) => summary.tag === UNTAGGED))) {
    return undefined;
  }
  return reported;
}

const notFound = (tag: string): ToolError =>
  new ToolError({
    code: 'NOT_FOUND',
    message: `No version tag "${tag}" exists for this project. List the tags with project_tag_list.`,
  });

/** The template stored under a tag whose id is already known. */
export async function templateOfEntry(
  config: ResolvedFormioConfig,
  { tag, id }: TagEntry
): Promise<Record<string, unknown>> {
  if (!id) {
    throw notFound(tag);
  }
  if (!isMongoId(id)) {
    throw new ToolError({
      code: 'UPSTREAM_ERROR',
      message: `Form.io returned tag "${tag}" with an id that is not a document id: ${id}`,
    });
  }
  const document = await formioFetch(`tag/${id}`, {}, config, {
    timeoutMs: templateTransferTimeoutMs(config),
  });
  const template = isRecord(document) ? document.template : undefined;
  if (!isRecord(template)) {
    throw new ToolError({
      code: 'UPSTREAM_ERROR',
      message: `Form.io returned tag "${tag}" without its template.`,
    });
  }
  return template;
}

/** The template a named tag stored, looking the tag up by name. */
export async function taggedTemplate(
  config: ResolvedFormioConfig,
  tag: string
): Promise<Record<string, unknown>> {
  const [found] = (await tagDocuments(config, { tag }))
    .map(entryOf)
    .filter((entry): entry is TagEntry => entry?.tag === tag);
  if (!found) {
    throw notFound(tag);
  }
  return templateOfEntry(config, found);
}

/** The project's current export. */
export async function exportProject(
  config: ResolvedFormioConfig
): Promise<Record<string, unknown>> {
  const exported = await formioFetch('export', {}, config, {
    timeoutMs: templateTransferTimeoutMs(config),
  });
  return isRecord(exported) ? exported : {};
}

/**
 * Form.io stores a tag with its project-level `access` emptied, so a template
 * refreshed from a tag would carry no project access lists. Where the stored lists
 * are empty, the project's current ones stand in.
 */
export function withProjectAccess(
  template: Record<string, unknown>,
  exported: Record<string, unknown>
): Record<string, unknown> {
  const stored = template.access;
  const emptied = Array.isArray(stored) && stored.length === 0;
  return emptied && Array.isArray(exported.access)
    ? { ...template, access: exported.access }
    : template;
}
