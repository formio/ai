// Compile examples against the installed packages' type declarations and report,
// by the example they belong to, the diagnostics that mean a wrong name. Each
// example is its own module, so names never collide between examples.

import ts from 'typescript';
import { compileInMemory, virtualPath } from './compile.js';
import type { Example } from './extract.js';

const where = (example: Example): string =>
  `${example.doc} example ${example.index} (line ${example.line})`;

const fileFor = (example: Example): string =>
  virtualPath(`${example.doc.replace(/[^A-Za-z0-9]+/g, '-')}-${example.index}.ts`);

export function typeProblems(examples: Example[]): string[] {
  const byFile = new Map(examples.map((example) => [fileFor(example), example]));
  const program = compileInMemory(
    Object.fromEntries([...byFile].map(([path, example]) => [path, example.code]))
  );
  return [...byFile].flatMap(([path, example]) => {
    const source = program.getSourceFile(path);
    if (!source) return [`${where(example)}: could not be compiled`];
    const checker = program.getTypeChecker();
    return [...program.getSyntacticDiagnostics(source), ...program.getSemanticDiagnostics(source)]
      .filter((diagnostic) => meansWrongName(diagnostic, source, checker))
      .map((diagnostic) => {
        const at =
          diagnostic.start === undefined
            ? ''
            : `:${source.getLineAndCharacterOfPosition(diagnostic.start).line + 1}`;
        const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
        return `${where(example)}${at}: TS${diagnostic.code} ${message}`;
      });
  });
}

// Cannot find name; module has no exported member (with and without a
// suggestion, and imported by default when it has no default).
const NAME_CODES = new Set([2304, 2305, 2614, 2724]);
// Cannot find module.
const MODULE_CODES = new Set([2307]);
// Property does not exist (with and without a suggestion).
const MEMBER_CODES = new Set([2339, 2551]);

function meansWrongName(
  diagnostic: ts.Diagnostic,
  source: ts.SourceFile,
  checker: ts.TypeChecker
): boolean {
  if (diagnostic.category !== ts.DiagnosticCategory.Error) return false;
  // Codes below 2000 are the parser's, and any of them means broken code.
  if (diagnostic.code < 2000) return true;
  if (NAME_CODES.has(diagnostic.code)) return true;
  if (MODULE_CODES.has(diagnostic.code)) {
    return /['"]@formio\//.test(ts.flattenDiagnosticMessageText(diagnostic.messageText, ' '));
  }
  if (MEMBER_CODES.has(diagnostic.code) && diagnostic.start !== undefined) {
    return isMemberOfImport(nodeAt(source, diagnostic.start), checker);
  }
  return false;
}

function nodeAt(source: ts.SourceFile, position: number): ts.Node | undefined {
  const find = (node: ts.Node): ts.Node | undefined =>
    position >= node.getStart(source) && position < node.getEnd()
      ? (ts.forEachChild(node, find) ?? node)
      : undefined;
  return find(source);
}

/** `Utils.notThere`: the missing member is read straight off an imported binding. */
function isMemberOfImport(node: ts.Node | undefined, checker: ts.TypeChecker): boolean {
  const access = node?.parent;
  if (!access || !ts.isPropertyAccessExpression(access) || access.name !== node) return false;
  if (!ts.isIdentifier(access.expression)) return false;
  const declarations = checker.getSymbolAtLocation(access.expression)?.declarations ?? [];
  return declarations.some(
    (declaration) =>
      ts.isImportSpecifier(declaration) ||
      ts.isNamespaceImport(declaration) ||
      ts.isImportClause(declaration)
  );
}
