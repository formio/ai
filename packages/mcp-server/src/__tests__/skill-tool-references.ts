// Reads the tool references in a skill document and reports the ones the registered
// tools contradict. Used by skill-tool-references.test.ts; kept apart so the rules
// can be tested on seeded text.

interface PropertySchema {
  enum?: unknown[];
}

// A tool's JSON input schema as tools/list reports it; only the argument names and
// their enums are read.
interface InputSchema {
  properties?: Record<string, object>;
}

export type ToolSchemas = Map<string, InputSchema | object>;

const TOOL = '(?:form|role|action|project|server)_[a-z_]+';
const TOOL_SHAPE = new RegExp(`^${TOOL}$`);

// Identifiers that fit the tool-name shape but name something else.
const LOOK_ALIKES = new Set([
  // The snake_case spelling of the Project URL variable, in the naming tables of
  // formio-api and formio-sdk.
  'project_url',
  // Arguments of the UAG's own MCP tools (`get_form_fields`, `collect_field_data`, ...),
  // which formio-uag documents for the user's agents; this server registers no such tool.
  'form_name',
  'form_data',
]);

interface Argument {
  name: string;
  value?: string;
}

interface Reference {
  tool: string;
  args: Argument[];
}

// A string literal, quoted either way; anything else is not a value to check.
function literal(text: string | undefined): string | undefined {
  const match = text?.trim().match(/^(['"])(.*)\1$/);
  return match ? match[2] : undefined;
}

// `name` or `name: value` from inside a backtick span.
function argumentIn(span: string): Argument | undefined {
  const match = span.match(/^([A-Za-z_]\w*)\s*(?::\s*(.*))?$/s);
  return match ? { name: match[1], value: literal(match[2]) } : undefined;
}

// The object literal's top-level `key` and `key: value` entries, from the text after
// its opening brace.
function objectEntries(text: string): Argument[] {
  const segments: string[] = [];
  let depth = 0;
  let quote = '';
  let current = '';
  for (const char of text) {
    if (quote) {
      current += char;
      if (char === quote) quote = '';
      continue;
    }
    if (char === '"' || char === "'" || char === '`') quote = char;
    // Only (), [] and {} nest; `<` and `>` are as often a comparison or an arrow
    // function's `=>` as a type argument.
    if ('{[('.includes(char)) depth += 1;
    if ('}])'.includes(char)) {
      if (depth === 0) break;
      depth -= 1;
    }
    if (char === ',' && depth === 0) {
      segments.push(current);
      current = '';
      continue;
    }
    current += char;
  }
  segments.push(current);
  return segments.flatMap((segment) => {
    const argument = argumentIn(segment.trim());
    return argument ? [argument] : [];
  });
}

function references(markdown: string): Reference[] {
  const named = [...markdown.matchAll(/`([^`\n]+)`/g)]
    .map((match) => match[1])
    .filter((span) => TOOL_SHAPE.test(span))
    .map((tool) => ({ tool, args: [] }));
  const prose = [
    ...markdown.matchAll(
      new RegExp(`\`(${TOOL})\`(?:\\s+\\w+){0,2}\\s+with\\s+\`([^\`\\n]+)\``, 'g')
    ),
  ].flatMap((match) => {
    const argument = argumentIn(match[2]);
    return argument ? [{ tool: match[1], args: [argument] }] : [];
  });
  const calls = [
    ...markdown.matchAll(new RegExp(`(?:mcp__[\\w-]+__|\\b)(${TOOL})\\s*\\(\\s*\\{`, 'g')),
  ].map((match) => ({
    tool: match[1],
    args: objectEntries(markdown.slice((match.index ?? 0) + match[0].length)),
  }));
  return [...named, ...prose, ...calls];
}

/** The ways `markdown` contradicts the registered tools, each stated once. */
export function referenceProblems(markdown: string, schemas: ToolSchemas): string[] {
  const problems = references(markdown).flatMap(({ tool, args }) => {
    if (LOOK_ALIKES.has(tool)) return [];
    const schema = schemas.get(tool) as InputSchema | undefined;
    if (!schema) return [`unregistered tool \`${tool}\``];
    const properties = schema.properties ?? {};
    return args.flatMap(({ name, value }) => {
      const property = properties[name] as PropertySchema | undefined;
      if (!property) return [`\`${tool}\` takes no argument \`${name}\``];
      if (value !== undefined && Array.isArray(property.enum) && !property.enum.includes(value)) {
        return [`\`${tool}\` argument \`${name}\` allows no value "${value}"`];
      }
      return [];
    });
  });
  return [...new Set(problems)];
}
