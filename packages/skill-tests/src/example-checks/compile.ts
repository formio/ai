// A TypeScript program over source files that exist only in memory, resolved as
// if they sat in this package — so `@formio/js` and the rest resolve to the
// versions installed here, through their own type declarations. Nothing runs.

import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

export const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

export const COMPILER_OPTIONS: ts.CompilerOptions = {
  target: ts.ScriptTarget.ES2022,
  module: ts.ModuleKind.NodeNext,
  moduleResolution: ts.ModuleResolutionKind.NodeNext,
  lib: ['lib.es2022.d.ts', 'lib.dom.d.ts'],
  types: ['node'],
  strict: false,
  skipLibCheck: true,
  noEmit: true,
  esModuleInterop: true,
};

/** Paths for in-memory files, inside this package so imports resolve here. */
export const virtualPath = (name: string): string => join(PACKAGE_ROOT, '.examples', name);

export function compileInMemory(files: Record<string, string>): ts.Program {
  const host = ts.createCompilerHost(COMPILER_OPTIONS);
  const original = {
    fileExists: host.fileExists,
    readFile: host.readFile,
    getSourceFile: host.getSourceFile,
  };
  host.fileExists = (path) => path in files || original.fileExists(path);
  host.readFile = (path) => files[path] ?? original.readFile(path);
  host.getSourceFile = (path, languageVersion, ...rest) =>
    path in files
      ? ts.createSourceFile(path, files[path], languageVersion, true)
      : original.getSourceFile(path, languageVersion, ...rest);
  return ts.createProgram({ rootNames: Object.keys(files), options: COMPILER_OPTIONS, host });
}
