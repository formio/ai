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

interface TagDocument extends Record<string, unknown> {
  _id?: unknown;
  tag?: unknown;
  chunk?: unknown;
}

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

/** Every tag of the project's family, newest first, without the stored templates. */
export async function listTags(config: ResolvedFormioConfig): Promise<TagSummary[]> {
  const documents = await tagDocuments(config, {
    sort: '-created',
    select: 'tag,description,created,chunk',
  });
  return documents
    .filter((document) => typeof document.tag === 'string')
    .map((document) => ({
      tag: document.tag as string,
      ...(typeof document.description === 'string' ? { description: document.description } : {}),
      ...(typeof document.created === 'string' ? { created: document.created } : {}),
    }));
}

/**
 * The tag the project is at, or undefined when it has never been tagged: Form.io
 * reports `0.0.0` for a project with no version, unless a tag of that name exists.
 */
export async function currentVersion(
  config: ResolvedFormioConfig,
  tags: TagSummary[]
): Promise<string | undefined> {
  const reply = await formioFetch('tag/current', {}, config);
  const tag = isRecord(reply) && typeof reply.tag === 'string' ? reply.tag : undefined;
  if (!tag || (tag === UNTAGGED && !tags.some((summary) => summary.tag === UNTAGGED))) {
    return undefined;
  }
  return tag;
}

/** The template a named tag stored. */
export async function taggedTemplate(
  config: ResolvedFormioConfig,
  tag: string
): Promise<Record<string, unknown>> {
  const [found] = (await tagDocuments(config, { tag, select: '_id,tag,chunk' })).filter(
    (document) => document.tag === tag
  );
  const id = found && typeof found._id === 'string' ? found._id : undefined;
  if (!id) {
    throw new ToolError({
      code: 'NOT_FOUND',
      message: `No version tag "${tag}" exists for this project. List the tags with project_tag_list.`,
    });
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
