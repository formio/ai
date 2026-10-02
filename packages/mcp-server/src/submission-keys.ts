import fs from 'fs';
import path from 'path';
import os from 'os';
import { createHmac, randomBytes } from 'crypto';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const STORE_FILE = 'mcp-submission-keys.json';
const KEY_BYTES = 32;

type KeyStore = Record<string, string>;

/**
 * The signing-key store could not be read. It is never treated as empty: a fresh key
 * written over an unreadable store would orphan every submission the old key signed,
 * silently, and the agent would lose access to its own rows without being told why.
 *
 * The message names neither the store's path nor its contents — the key must not reach
 * a tool result, and an error message is one.
 */
export class SubmissionKeyStoreUnreadableError extends Error {
  constructor(reason: string) {
    super(
      `The local signing-key store for agent-created submissions is unreadable (${reason}). ` +
        'It was left untouched. Repair or remove it; removing it makes submissions signed with the old key unreadable to the submission tools, though they stay visible in the Form.io portal.'
    );
    this.name = 'SubmissionKeyStoreUnreadableError';
  }
}

/** Same rule as the project map, so one directory has one key whatever its spelling. */
function storeKey(cwd: string): string {
  return path.resolve(cwd);
}

function isKeyStore(value: unknown): value is KeyStore {
  return (
    typeof value === 'object' &&
    value !== null &&
    !Array.isArray(value) &&
    Object.values(value).every((entry) => typeof entry === 'string')
  );
}

function readStore(cacheDir: string): KeyStore {
  let raw: string;
  try {
    raw = fs.readFileSync(path.join(cacheDir, STORE_FILE), 'utf-8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return {};
    }
    throw new SubmissionKeyStoreUnreadableError(
      (error as NodeJS.ErrnoException).code ?? 'read failed'
    );
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    throw new SubmissionKeyStoreUnreadableError('not valid JSON');
  }
  if (!isKeyStore(parsed)) {
    throw new SubmissionKeyStoreUnreadableError('expected an object mapping directories to keys');
  }
  return Object.fromEntries(Object.entries(parsed).map(([dir, key]) => [storeKey(dir), key]));
}

function writeStore(cacheDir: string, store: KeyStore): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, STORE_FILE), JSON.stringify(store), { mode: 0o600 });
}

function decodeKey(encoded: string): Buffer {
  const key = Buffer.from(encoded, 'base64');
  if (key.length !== KEY_BYTES) {
    throw new SubmissionKeyStoreUnreadableError('an entry is not a 32-byte key');
  }
  return key;
}

export interface KeyLookup {
  cwd: string;
  cacheDir?: string;
}

/** The signing key for one working directory, created on first use. */
export function getOrCreateKey({ cwd, cacheDir = DEFAULT_CACHE_DIR }: KeyLookup): Buffer {
  const store = readStore(cacheDir);
  const dir = storeKey(cwd);
  const existing = store[dir];
  if (existing !== undefined) {
    return decodeKey(existing);
  }
  const key = randomBytes(KEY_BYTES);
  writeStore(cacheDir, { ...store, [dir]: key.toString('base64') });
  return key;
}

/**
 * The label that narrows the index query to one directory's rows. Derived from the key,
 * so it reveals neither the key nor the directory's path; it is not a secret — the
 * signature, not the label, is what a record must carry to verify.
 */
export function sessionLabel(key: Buffer): string {
  return createHmac('sha256', key).update('agent-session').digest('hex').slice(0, 32);
}
