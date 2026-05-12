import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { RepoEdge, RepoModel, RepoPackage } from '../types';
import { listPackageJsons } from './package-json';

type PackageJson = {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
  peerDependencies?: Record<string, string>;
};

function toPosix(p: string) {
  return p.split(path.sep).join(path.posix.sep);
}

function rel(repo: string, abs: string) {
  return toPosix(path.relative(repo, abs));
}

export async function scanRepo(opts: { repo: string }): Promise<RepoModel> {
  const repoRoot = path.resolve(opts.repo);

  const packageJsonPaths = await listPackageJsons(repoRoot);
  const pkgs: RepoPackage[] = [];

  for (const pkgJsonPath of packageJsonPaths) {
    const txt = await readFile(pkgJsonPath, 'utf8');
    const parsed = JSON.parse(txt) as PackageJson;
    const name = parsed.name;
    if (!name) continue;

    const dir = path.dirname(pkgJsonPath);
    const scripts = parsed.scripts ?? {};

    const allDeps = {
      ...(parsed.dependencies ?? {}),
      ...(parsed.devDependencies ?? {}),
      ...(parsed.peerDependencies ?? {})
    };

    pkgs.push({
      name,
      dir,
      relDir: rel(repoRoot, dir),
      packageJsonPath: pkgJsonPath,
      relPackageJsonPath: rel(repoRoot, pkgJsonPath),
      scripts,
      internalDeps: Object.keys(allDeps)
    });
  }

  const pkgNames = new Set(pkgs.map(p => p.name));
  for (const p of pkgs) {
    p.internalDeps = p.internalDeps.filter(d => pkgNames.has(d));
  }

  const edges: RepoEdge[] = [];
  for (const p of pkgs) {
    for (const d of p.internalDeps) edges.push({ from: p.name, to: d });
  }

  edges.sort((a, b) => (a.from + '→' + a.to).localeCompare(b.from + '→' + b.to));
  pkgs.sort((a, b) => a.name.localeCompare(b.name));

  return { repoRoot, packages: pkgs, deps: edges };
}
