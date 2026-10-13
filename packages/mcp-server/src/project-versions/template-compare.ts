/**
 * What changed between two project templates — the project as it is now and the
 * template a version tag stored. Entities are compared under the keys the template
 * gives them (machine names; `form:action` for actions). Form.io's exporter keeps only
 * design fields — no `_id`, timestamps, or owner — so two exports of an unchanged
 * project compare equal however far apart they were taken.
 */

export const TEMPLATE_KINDS = ['roles', 'resources', 'forms', 'actions'] as const;
export type TemplateKind = (typeof TEMPLATE_KINDS)[number];

export interface KindChanges {
  added: string[];
  removed: string[];
  changed: string[];
}

export type TemplateChanges = Record<TemplateKind, KindChanges>;

type Entities = Record<string, unknown>;

function entitiesOf(template: Record<string, unknown>, kind: TemplateKind): Entities {
  const section = template[kind];
  return typeof section === 'object' && section !== null && !Array.isArray(section)
    ? (section as Entities)
    : {};
}

/** JSON with object keys sorted, so key order never reads as a change. */
function canonical(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonical).join(',')}]`;
  }
  if (typeof value === 'object' && value !== null) {
    const entries = Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical((value as Entities)[key])}`);
    return `{${entries.join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

function compareKind(current: Entities, tagged: Entities): KindChanges {
  const now = Object.keys(current);
  const then = Object.keys(tagged);
  return {
    added: now.filter((name) => !(name in tagged)).sort(),
    removed: then.filter((name) => !(name in current)).sort(),
    changed: now
      .filter((name) => name in tagged && canonical(current[name]) !== canonical(tagged[name]))
      .sort(),
  };
}

export function compareTemplates({
  current,
  tagged,
}: {
  current: Record<string, unknown>;
  tagged: Record<string, unknown>;
}): TemplateChanges {
  return Object.fromEntries(
    TEMPLATE_KINDS.map((kind) => [
      kind,
      compareKind(entitiesOf(current, kind), entitiesOf(tagged, kind)),
    ])
  ) as TemplateChanges;
}
