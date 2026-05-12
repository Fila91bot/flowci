import { mkdir, readFile, writeFile, stat } from 'node:fs/promises';

export async function ensureDir(dir: string) {
  await mkdir(dir, { recursive: true });
}

export async function fileExists(path: string) {
  try {
    const s = await stat(path);
    return s.isFile() || s.isFIFO();
  } catch {
    return false;
  }
}

export async function readJsonIfExists<T>(path: string): Promise<T | null> {
  if (!(await fileExists(path))) return null;
  const text = await readFile(path, 'utf8');
  return JSON.parse(text) as T;
}

export async function writeJson(path: string, obj: unknown, opts?: { pretty?: boolean }) {
  const pretty = opts?.pretty ? 2 : 0;
  const text = JSON.stringify(obj, null, pretty) + '\n';
  const dir = path.split('/').slice(0, -1).join('/');
  if (dir) await ensureDir(dir);
  await writeFile(path, text, 'utf8');
}

