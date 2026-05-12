import path from 'node:path';

function toPosix(p: string) {
  return p.split(path.sep).join(path.posix.sep);
}

export function normalizePaths(repoRoot: string, paths: string[]) {
  const repo = path.resolve(repoRoot);
  return paths.map(p => {
    const abs = path.isAbsolute(p) ? p : path.join(repo, p);
    return toPosix(path.relative(repo, abs));
  });
}

