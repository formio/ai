import fs from 'fs';
import path from 'path';
import { normalizeHttpUrl } from './config.js';

export const COMMITTED_CONFIG_FILE = 'formio.json';

// The committed counterpart to ~/.formio/projects.json. That map is keyed by
// absolute path and lives in a home directory, so a clone starts unmapped and no
// reviewer can see which deployment a branch targets. This file travels with the
// code instead: it records what THIS application targets, in a diff.
export interface CommittedProjectConfig {
  projectUrl: string;
  baseUrl?: string;
  // Which file supplied the answer. Reported by `project get`, because the
  // upward walk means the governing file is often not the one in the directory
  // the caller is standing in — "why this project?" is otherwise unanswerable.
  filePath: string;
}

// A file that exists and cannot be used is NOT an absent file, and the
// distinction is load-bearing: reporting it as "nothing configured" sends the
// caller to project_set, which writes a mapping this file then shadows. The
// symptom clears, the cause persists, and the precedence order hides it. Same
// reasoning as ProjectMapUnreadableError, one layer up.
export class CommittedConfigUnusableError extends Error {
  // Carried as a field, not only inside the message. `project set --scope repo` is
  // the documented repair for this file, so the writer has to be able to land on
  // the exact path the walk rejected rather than parse it back out of prose.
  readonly filePath: string;

  constructor(filePath: string, reason: string) {
    super(
      `The committed Form.io configuration at ${filePath} cannot be used: ${reason}. ` +
        `Fix that file — it takes precedence over the working-directory mapping, so writing a mapping will not override it.`
    );
    this.name = 'CommittedConfigUnusableError';
    this.filePath = filePath;
  }
}

function readOne(filePath: string): CommittedProjectConfig {
  let raw: string;
  try {
    raw = fs.readFileSync(filePath, 'utf8');
  } catch (error) {
    throw new CommittedConfigUnusableError(
      filePath,
      error instanceof Error ? error.message : String(error)
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new CommittedConfigUnusableError(
      filePath,
      `it is not valid JSON (${error instanceof Error ? error.message : String(error)})`
    );
  }

  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    throw new CommittedConfigUnusableError(filePath, 'the top level is not a JSON object');
  }

  // Unknown keys are ignored rather than rejected, so the file can carry a
  // $schema or a convention key without failing every tool call.
  const record = parsed as Record<string, unknown>;
  const projectUrl = record.projectUrl;
  if (typeof projectUrl !== 'string' || projectUrl.trim() === '') {
    throw new CommittedConfigUnusableError(
      filePath,
      'it has no `projectUrl`, which is the one required key'
    );
  }

  const normalize = (value: string, key: string) => {
    try {
      return normalizeHttpUrl(value, key);
    } catch (error) {
      throw new CommittedConfigUnusableError(
        filePath,
        error instanceof Error ? error.message : String(error)
      );
    }
  };

  const baseUrl = record.baseUrl;
  return {
    projectUrl: normalize(projectUrl, 'projectUrl'),
    ...(typeof baseUrl === 'string' && baseUrl.trim() !== ''
      ? { baseUrl: normalize(baseUrl, 'baseUrl') }
      : {}),
    filePath,
  };
}

// Walks from `startDir` toward the filesystem root and returns the FIRST file it
// finds, so the nearest one wins and a monorepo's folders can target different
// projects with no extra mechanism — the .editorconfig / tsconfig / .npmrc rule.
//
// The walk stops at a directory containing `.git`, inclusive. Without that
// boundary a stray formio.json in a home directory governs every repository
// beneath it. Inclusive because a repository-root file is the common case.
export function findCommittedConfig(startDir: string): CommittedProjectConfig | undefined {
  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, COMMITTED_CONFIG_FILE);
    if (fs.existsSync(candidate)) {
      return readOne(candidate);
    }
    // Checked AFTER the file, so the repository root's own file is found.
    if (fs.existsSync(path.join(dir, '.git'))) {
      return undefined;
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      return undefined;
    }
    dir = parent;
  }
}

// Where `project set --scope repo` writes: the nearest existing file when the walk
// finds one, otherwise the caller's own directory. Never an ancestor that has no
// file — the default placement is the directory the caller named, because a file
// created higher up would govern everything beneath it.
export function committedConfigWritePath(startDir: string): string {
  try {
    const found = findCommittedConfig(startDir);
    return found?.filePath ?? path.join(path.resolve(startDir), COMMITTED_CONFIG_FILE);
  } catch (error) {
    // A broken file is still the file to rewrite; repairing it is the point — and
    // the file to repair is the one the walk found, which the error names. Falling
    // back to <startDir>/formio.json instead created a SECOND file below an
    // unusable ancestor and left that ancestor governing every sibling directory,
    // after CommittedConfigUnusableError had told the user it was the thing to fix.
    if (error instanceof CommittedConfigUnusableError) {
      return error.filePath;
    }
    throw error;
  }
}
