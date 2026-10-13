// The `Formio.<name>` and `Utils.<name>` reads in examples that the installed
// objects do not have. Read at runtime: `@formio/js` declares `Formio` as `any`,
// so the compiler cannot tell a real static from a misspelled one.

import { codeOnly, type Example } from './extract.js';

const where = (example: Example): string =>
  `${example.doc} example ${example.index} (line ${example.line})`;

// A bare `Formio.x` or `Utils.x` — not `obj.Formio.x`, not `new Formio(...).x`.
const MEMBER = /(?<![\w$.])(Formio|Utils)\.([A-Za-z_$][\w$]*)/g;

async function realObjects(): Promise<Record<string, object>> {
  const { Formio } = await import('@formio/js');
  const { Utils } = await import('@formio/js/utils');
  return { Formio, Utils };
}

export async function memberProblems(examples: Example[]): Promise<string[]> {
  const objects = await realObjects();
  return examples.flatMap((example) =>
    [...codeOnly(example.code).matchAll(MEMBER)]
      .filter(([, owner, name]) => !(name in objects[owner]))
      .map(([, owner, name]) => `${where(example)}: ${owner} has no ${name}`)
      .filter((problem, index, all) => all.indexOf(problem) === index)
  );
}
