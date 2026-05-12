import { spawnSync } from 'node:child_process';
import path from 'node:path';

function runGit(repo: string, args: string[]) {
  const res = spawnSync('git', args, { cwd: repo, encoding: 'utf8' });
  if (res.status !== 0) {
    return null; // ← Fallback umjesto error
  }
  return String(res.stdout ?? '');
}

export async function computeChangedFiles(opts: { repo: string; base: string; head: string }): Promise<string[]> {
  const repo = path.resolve(opts.repo);

  const base = opts.base?.trim();
  const head = opts.head?.trim();

  let out = '';
  
  if (base && head) {
    out = runGit(repo, ['diff', '--name-only', `${base}..${head}`]) ?? '';
  } else if (base && !head) {
    out = runGit(repo, ['diff', '--name-only', `${base}..HEAD`]) ?? '';
  } else {
    out = runGit(repo, ['diff', '--name-only', 'HEAD']) ?? '';
  }

  // Ako git nije dostupan, vrati prazan array (nema changed files)
  return out
    .split('\n')
    .map(s => s.trim())
    .filter(Boolean);
}
