// The imports in a set of examples that the installed packages cannot satisfy.

import { type Example, namedImports } from './extract.js';
import { exportsOf } from './module-exports.js';
import { CHECKED_PACKAGES } from './skill-examples.js';

const checked = (module: string): boolean =>
  CHECKED_PACKAGES.some((pkg) => module === pkg || module.startsWith(`${pkg}/`));

const where = (example: Example): string =>
  `${example.doc} example ${example.index} (line ${example.line})`;

export function importProblems(examples: Example[]): string[] {
  return examples.flatMap((example) =>
    namedImports(example.code)
      .filter(({ module }) => checked(module))
      .flatMap(({ module, name }) => {
        const names = exportsOf(module);
        if (!names) return [`${where(example)}: ${module} does not resolve`];
        return names.has(name) ? [] : [`${where(example)}: ${module} exports no ${name}`];
      })
  );
}
