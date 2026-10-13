// Code examples in the skills, pulled out of their markdown so they can be
// checked against the packages they document.
//
// An example is "self-contained" when it can be compiled on its own: a TypeScript
// block that imports from a Form.io package and has no placeholder standing in
// for code the reader is meant to supply. A block without a Form.io import leans
// on the text around it (a `form` from the previous step, an instance built
// earlier), so it is checked for its imports only. A block that has an import but
// is still deliberately partial carries `<!-- example: fragment -->` on the
// nearest non-blank line above its fence.

export interface Example {
  /** The markdown file's path, as the caller named it. */
  doc: string;
  /** Position among the document's code examples, from 0. */
  index: number;
  lang: 'js' | 'ts' | 'tsx';
  /** 1-based line of the opening fence. */
  line: number;
  code: string;
  fragment: boolean;
}

export interface NamedImport {
  module: string;
  /** The exported name, or `default` for a default import. */
  name: string;
}

export const FRAGMENT_MARKER = '<!-- example: fragment -->';

const LANGS: Record<string, Example['lang']> = {
  js: 'js',
  javascript: 'js',
  mjs: 'js',
  jsx: 'js',
  ts: 'ts',
  typescript: 'ts',
  tsx: 'tsx',
};

const FENCE = /^(`{3,})([A-Za-z]*)[^\n]*$/;

export function extractExamples(doc: string, markdown: string): Example[] {
  const lines = markdown.split('\n');
  const examples: Example[] = [];
  let i = 0;
  while (i < lines.length) {
    const open = FENCE.exec(lines[i]);
    if (!open) {
      i += 1;
      continue;
    }
    const close = lines.findIndex(
      (line, at) => at > i && line.startsWith(open[1]) && line.trim() === open[1]
    );
    const end = close === -1 ? lines.length : close;
    const lang = LANGS[open[2].toLowerCase()];
    if (lang) {
      examples.push({
        doc,
        index: examples.length,
        lang,
        line: i + 1,
        code: lines.slice(i + 1, end).join('\n') + '\n',
        fragment: markedAsFragment(lines, i),
      });
    }
    i = end + 1;
  }
  return examples;
}

function markedAsFragment(lines: string[], fenceAt: number): boolean {
  const before = lines
    .slice(0, fenceAt)
    .reverse()
    .find((line) => line.trim() !== '');
  return before?.trim() === FRAGMENT_MARKER;
}

/** The code with comments removed and string and template literals emptied. */
export function codeOnly(code: string): string {
  let out = '';
  let i = 0;
  while (i < code.length) {
    const two = code.slice(i, i + 2);
    if (two === '//') {
      const end = code.indexOf('\n', i);
      i = end === -1 ? code.length : end;
    } else if (two === '/*') {
      const end = code.indexOf('*/', i + 2);
      i = end === -1 ? code.length : end + 2;
    } else if (code[i] === "'" || code[i] === '"' || code[i] === '`') {
      const quote = code[i];
      let j = i + 1;
      while (j < code.length && code[j] !== quote) {
        j += code[j] === '\\' ? 2 : 1;
      }
      out += quote + quote;
      i = j + 1;
    } else {
      out += code[i];
      i += 1;
    }
  }
  return out;
}

/**
 * A placeholder is `…`, or `...` that spreads nothing — followed by a closing
 * bracket, a separator, or the end of the line — outside comments and strings.
 */
export function hasPlaceholder(code: string): boolean {
  const source = codeOnly(code);
  return source.includes('…') || /\.\.\.(?=[ \t]*([)\]},;]|$))/m.test(source);
}

const IMPORT =
  /import\s+(?:type\s+)?(?:([A-Za-z_$][\w$]*)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*['"]([^'"]+)['"]/g;

export function namedImports(code: string): NamedImport[] {
  return [...codeOnlyImports(code).matchAll(IMPORT)].flatMap((match) => {
    const [, defaultName, braces, module] = match;
    const named = (braces ?? '')
      .split(',')
      .map((part) =>
        part
          .trim()
          .replace(/^type\s+/, '')
          .split(/\s+as\s+/)[0]
          .trim()
      )
      .filter((name) => name !== '');
    return [...(defaultName ? ['default'] : []), ...named].map((name) => ({ module, name }));
  });
}

/** Import statements need their module strings, so only comments are removed. */
function codeOnlyImports(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

export function isSelfContained(example: Example): boolean {
  return (
    example.lang === 'ts' &&
    !example.fragment &&
    namedImports(example.code).some(({ module }) => module.startsWith('@formio/')) &&
    !hasPlaceholder(example.code)
  );
}
