// What an installed module exports, read from its type declarations: the names an
// example may import. Read through the compiler rather than by importing the
// module, so a package that needs a framework at runtime (`@formio/react` needs
// React) is still checked.

import ts from 'typescript';
import { compileInMemory, virtualPath } from './compile.js';

const cache = new Map<string, Set<string> | undefined>();

export function exportsOf(specifier: string): Set<string> | undefined {
  if (!cache.has(specifier)) {
    cache.set(specifier, readExports(specifier));
  }
  return cache.get(specifier);
}

function readExports(specifier: string): Set<string> | undefined {
  const path = virtualPath('exports-probe.ts');
  const program = compileInMemory({
    [path]: `import * as probe from ${JSON.stringify(specifier)};\nexport { probe };\n`,
  });
  const source = program.getSourceFile(path);
  const declaration = source?.statements.find(ts.isImportDeclaration);
  if (!declaration) {
    return undefined;
  }
  const checker = program.getTypeChecker();
  const symbol = checker.getSymbolAtLocation(declaration.moduleSpecifier);
  if (!symbol) {
    return undefined;
  }
  const names = checker.getExportsOfModule(symbol).map((exported) => exported.getName());
  // `export =` modules expose their members through the assigned value.
  const assigned = symbol.exports?.get('export=' as ts.__String);
  const members = assigned
    ? checker
        .getPropertiesOfType(checker.getTypeOfSymbolAtLocation(assigned, declaration))
        .map((p) => p.getName())
    : [];
  return new Set([...names, ...members, ...(assigned ? ['default'] : [])]);
}
