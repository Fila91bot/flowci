import { readdir } from 'node:fs/promises';
import path from 'node:path';

async function walk(dir: string, out: string[]) {
  const entries = await readdir(dir, { withFileTypes: true });
  for (const e of entries) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue;
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      await walk(full, out);
      continue;
    }
    if (e.isFile() && e.name === 'package.json') out.push(full);
  }
}

export async function listPackageJsons(repoRoot: string): Promise<string[]> {
  const candidates: string[] = [];

  // Pragmatic default: monorepo under packages/*
  const packagesDir = path.join(repoRoot, 'packages');
  try {
    await walk(packagesDir, candidates);
  } catch {
    // fallback: scan whole repo (best-effort)
    await walk(repoRoot, candidates);
  }

  // Skip root package.json
  return candidates.filter(p => path.dirname(p) !== repoRoot);
}

