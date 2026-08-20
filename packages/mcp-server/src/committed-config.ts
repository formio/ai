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

export interface FindCommittedConfigOptions {
  // Why a file on the walk was passed over. Silence here is a directory whose
  // formio.json is visibly ignored with no reason given anywhere.
  onNote?: (message: string) => void;
}

// `formio.json` is a name a Form.io user is likely to already be using for
// something else — an exported form, a project template, a CLI config — and none
// of those documents configure this server. Treating one as a broken
// configuration failed EVERY tool call for that directory, with no source able to
// override it and no repair short of overwriting a file this server does not own.
//
// So the question asked first is "is this file addressed to us?", answered by the
// only two keys this format has. A file naming neither is somebody else's; a file
// naming one of them is ours and is held to the format.
function namesEitherUrl(record: Record<string, unknown>): boolean {
  return 'projectUrl' in record || 'baseUrl' in record;
}

// Undefined means "not this server's file, keep walking". Throwing means "ours,
// and broken".
function readOne(
  filePath: string,
  onNote: (message: string) => void
): CommittedProjectConfig | undefined {
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

  // An array or a scalar is nobody's configuration in this format — an exported
  // form list, say — so it is passed over rather than failing every call.
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    onNote(
      `Ignoring ${filePath}: its top level is not a JSON object, so it is not a Form.io project configuration. Continuing the search above it.`
    );
    return undefined;
  }

  // Unknown keys are ignored rather than rejected, so the file can carry a
  // $schema or a convention key without failing every tool call.
  const record = parsed as Record<string, unknown>;
  if (!namesEitherUrl(record)) {
    onNote(
      `Ignoring ${filePath}: it holds neither "projectUrl" nor "baseUrl", so it is not a Form.io project configuration. Continuing the search above it.`
    );
    return undefined;
  }

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

// Walks from `startDir` toward the filesystem root and returns the FIRST usable
// file it finds, so the nearest one wins and a monorepo's folders can target
// different projects with no extra mechanism — the .editorconfig / tsconfig /
// .npmrc rule.
//
// The walk stops at a directory containing `.git`, inclusive. Without that
// boundary a stray formio.json in a home directory governs every repository
// beneath it. Inclusive because a repository-root file is the common case.
export function findCommittedConfig(
  startDir: string,
  { onNote = () => {} }: FindCommittedConfigOptions = {}
): CommittedProjectConfig | undefined {
  let dir = path.resolve(startDir);

  for (;;) {
    const candidate = path.join(dir, COMMITTED_CONFIG_FILE);
    if (fs.existsSync(candidate)) {
      const found = readOne(candidate, onNote);
      // Only a file addressed to this server ends the walk. One that is not — an
      // exported form that happens to be called formio.json — is passed over, so
      // a configuration above it still governs.
      if (found) {
        return found;
      }
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

export interface CommittedWriteRequest {
  startDir: string;
  // The project the write will record, already normalized, when the caller is
  // recording one. Omitted when the write only amends a base URL, which is an
  // edit to whichever file already holds the project.
  projectUrl?: string;
}

export interface CommittedWritePlan {
  filePath: string;
  // The ancestor configuration this write will take precedence over, when the
  // write deliberately lands below one. Reported so the writer can say so: a
  // caller who asked to record a project for one folder has to be told that a
  // different file still governs the folders beside it.
  shadows?: CommittedProjectConfig;
}

// Where `project set --scope repo` writes.
//
// Two rules, and the second is what makes per-folder targeting possible at all.
// A write that AMENDS what a file already says — a base URL for the project it
// already names, or the same project again — lands on that file wherever the walk
// found it, so a second `project set` updates the first one's file rather than
// shadowing it from a deeper directory. A write that records a DIFFERENT project
// lands in the directory the caller named: rewriting an ancestor there would
// silently re-point every sibling folder beneath it, which is the opposite of
// what "set the project for this folder" asks for, and it made the per-folder
// targeting the read side advertises impossible to create.
export function planCommittedConfigWrite({
  startDir,
  projectUrl,
}: CommittedWriteRequest): CommittedWritePlan {
  const dir = path.resolve(startDir);
  const here = path.join(dir, COMMITTED_CONFIG_FILE);

  let found: CommittedProjectConfig | undefined;
  try {
    found = findCommittedConfig(dir);
  } catch (error) {
    // A broken file is still the file to rewrite; repairing it is the point — and
    // the file to repair is the one the walk found, which the error names. Falling
    // back to <startDir>/formio.json instead created a SECOND file below an
    // unusable ancestor and left that ancestor governing every sibling directory,
    // after CommittedConfigUnusableError had told the user it was the thing to fix.
    if (error instanceof CommittedConfigUnusableError) {
      return { filePath: error.filePath };
    }
    throw error;
  }

  if (!found || found.filePath === here) {
    return { filePath: here };
  }
  if (!projectUrl || projectUrl === found.projectUrl) {
    return { filePath: found.filePath };
  }
  return { filePath: here, shadows: found };
}
