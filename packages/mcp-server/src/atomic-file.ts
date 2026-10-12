import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { pauseSync } from './sync-pause.js';

export interface AtomicWrite {
  filePath: string;
  contents: string;
}

// Codes a rename over a file returns on Windows while another process briefly has the
// target open — an antivirus scanner, a search indexer, a reader mid-read. Each clears
// on its own within milliseconds.
const TRANSIENT_RENAME_CODES: ReadonlySet<string> = new Set(['EPERM', 'EBUSY', 'EACCES']);
const RENAME_ATTEMPTS = 5;
const RENAME_BACKOFF_MS = 20;

const codeOf = (error: unknown): string | undefined =>
  error instanceof Error ? (error as NodeJS.ErrnoException).code : undefined;

/** Whether a failure is one a short pause can clear on Windows. */
export const isTransientFileError = (error: unknown): boolean =>
  TRANSIENT_RENAME_CODES.has(codeOf(error) ?? '');

export interface RenameRequest {
  from: string;
  to: string;
  attempt?: number;
}

/**
 * A rename, retried with a growing pause while the failure is one Windows clears on its
 * own (EPERM, EBUSY, EACCES). Anything else, or the last attempt's failure, is rethrown
 * as it came.
 */
export function renameWithRetry({ from, to, attempt = 1 }: RenameRequest): void {
  try {
    fs.renameSync(from, to);
  } catch (error) {
    if (attempt >= RENAME_ATTEMPTS || !isTransientFileError(error)) {
      throw error;
    }
    pauseSync(RENAME_BACKOFF_MS * attempt);
    renameWithRetry({ from, to, attempt: attempt + 1 });
  }
}

/**
 * Replace a file in one step: write a temporary file in the same directory, created
 * 0600, and rename it over the target. A rename within a directory replaces the file
 * atomically, so a concurrent reader — another server, or the CLI — sees the old file
 * or the new one, never a partial one. A rename that fails with EPERM, EBUSY or EACCES
 * is retried a few times first. The temporary file is removed when any step fails, and
 * the failure is rethrown for the caller to name its own file.
 */
export function writeFileAtomically({ filePath, contents }: AtomicWrite): void {
  const directory = path.dirname(filePath);
  const temporary = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${randomUUID()}.tmp`
  );
  try {
    fs.mkdirSync(directory, { recursive: true });
    fs.writeFileSync(temporary, contents, { mode: 0o600, flag: 'wx' });
    renameWithRetry({ from: temporary, to: filePath });
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
