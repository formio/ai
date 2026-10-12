import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

export interface AtomicWrite {
  filePath: string;
  contents: string;
}

/**
 * Replace a file in one step: write a temporary file in the same directory, created
 * 0600, and rename it over the target. A rename within a directory replaces the file
 * atomically, so a concurrent reader — another server, or the CLI — sees the old file
 * or the new one, never a partial one. The temporary file is removed when any step
 * fails, and the failure is rethrown for the caller to name its own file.
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
    fs.renameSync(temporary, filePath);
  } catch (error) {
    fs.rmSync(temporary, { force: true });
    throw error;
  }
}
