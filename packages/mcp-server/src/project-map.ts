import fs from 'fs';
import path from 'path';
import os from 'os';

const DEFAULT_CACHE_DIR = path.join(os.homedir(), '.formio');
const PROJECTS_FILE = 'projects.json';

export interface ProjectEntry {
  env: Record<string, string>;
}

type ProjectMap = Record<string, ProjectEntry>;

function readMap(cacheDir: string): ProjectMap {
  const filePath = path.join(cacheDir, PROJECTS_FILE);
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf-8')) as ProjectMap;
  } catch {
    return {};
  }
}

function writeMap(cacheDir: string, data: ProjectMap): void {
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(path.join(cacheDir, PROJECTS_FILE), JSON.stringify(data), {
    mode: 0o600,
  });
}

export function readProjectEntry(
  cwd: string,
  cacheDir: string = DEFAULT_CACHE_DIR
): ProjectEntry | null {
  const map = readMap(cacheDir);
  return map[cwd] ?? null;
}

export function writeProjectEntry(
  cwd: string,
  env: Record<string, string>,
  cacheDir: string = DEFAULT_CACHE_DIR
): void {
  const map = readMap(cacheDir);
  map[cwd] = { env };
  writeMap(cacheDir, map);
}
