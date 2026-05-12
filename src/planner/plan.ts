import path from 'node:path';
import { Keys } from '../flow/keys';
import { newTrace, traceDerived, traceJob, tracePackageChain, traceSource } from '../flow/trace';
import { RepoModel } from '../repo/types';
import { sha256Text } from '../utils/hash';
import { FlowPlan, PlannedJob } from './types';

function toPosix(p: string) {
  return p.split(path.sep).join(path.posix.sep);
}

function packageForFile(repoModel: RepoModel, fileRel: string): string | null {
  const f = toPosix(fileRel);
  // Choose the most specific package dir that prefixes the file path.
  let best: { name: string; relDir: string } | null = null;
  for (const p of repoModel.packages) {
    const dir = toPosix(p.relDir).replace(/\/$/, '');
    if (!dir) continue;
    if (f === dir || f.startsWith(dir + '/')) {
      if (!best || dir.length > best.relDir.length) best = { name: p.name, relDir: dir };
    }
  }
  return best?.name ?? null;
}

function buildReverseDeps(repoModel: RepoModel) {
  const r = new Map<string, Set<string>>(); // to -> from
  for (const e of repoModel.deps) {
    if (!r.has(e.to)) r.set(e.to, new Set());
    r.get(e.to)!.add(e.from);
  }
  return r;
}

function affectedClosureWithChains(repoModel: RepoModel, direct: Set<string>) {
  const reverse = buildReverseDeps(repoModel);
  const out = new Set(direct);
  const q = [...direct];

  // dependentPkg -> dependencyPkg that caused it to be included
  const parent = new Map<string, string>();

  while (q.length) {
    const cur = q.shift()!;
    const parents = reverse.get(cur);
    if (!parents) continue;
    for (const p of parents) {
      if (out.has(p)) continue;
      out.add(p);
      parent.set(p, cur);
      q.push(p);
    }
  }

  const chains = new Map<string, string[]>();
  for (const pkg of out) {
    const chain: string[] = [pkg];
    let cur = pkg;
    const visited = new Set<string>([cur]);
    while (!direct.has(cur)) {
      const next = parent.get(cur);
      if (!next) break;
      if (visited.has(next)) break;
      visited.add(next);
      chain.push(next);
      cur = next;
    }
    chains.set(pkg, chain);
  }

  return { affected: out, chains };
}

function jobId(kind: 'build' | 'test', pkg: string) {
  return `${kind}:${pkg}`;
}

export function planFlow(opts: { repo: string; repoModel: RepoModel; changedFiles: string[]; tool: 'pnpm' | 'npm' }): FlowPlan {
  const { repoModel, changedFiles, tool } = opts;
  const trace = newTrace();

  traceSource(trace, Keys.changedFiles, 'git diff --name-only');
  traceSource(trace, Keys.repoPackages, 'repo scan packages/*/package.json');
  traceSource(trace, Keys.repoDeps, 'internal deps from package.json dependency fields');

  const directTouched = new Set<string>();
  for (const f of changedFiles) {
    const pkg = packageForFile(repoModel, f);
    if (pkg) directTouched.add(pkg);
  }

  const { affected, chains } = affectedClosureWithChains(repoModel, directTouched);
  const affectedPackages = Array.from(affected).sort();

  for (const pkg of affectedPackages) {
    const chain = chains.get(pkg);
    if (chain && chain.length > 0) tracePackageChain(trace, pkg, chain);
  }
  traceDerived(
    trace,
    Keys.affectedPackages,
    [Keys.changedFiles, Keys.repoPackages, Keys.repoDeps],
    'file→package mapping + reverse-deps closure'
  );

  const pkgsByName = new Map(repoModel.packages.map(p => [p.name, p]));

  const buildPlan: PlannedJob[] = [];
  const testPlan: PlannedJob[] = [];

  for (const pkg of affectedPackages) {
    const p = pkgsByName.get(pkg);
    if (!p) continue;

    const cwdRel = p.relDir;

    if (p.scripts?.build) {
      const cacheKey = sha256Text(JSON.stringify({ kind: 'build', pkg, tool, changedFiles })).slice(0, 24);
      const id = jobId('build', pkg);
      const exec =
        tool === 'pnpm'
          ? { command: 'pnpm', args: ['-C', repoModel.repoRoot, '--filter', pkg, 'run', 'build'] }
          : { command: 'npm', args: ['-w', cwdRel, 'run', 'build'] };
      buildPlan.push({
        id,
        kind: 'build',
        package: pkg,
        cwdRel,
        exec,
        cacheKey
      });
      traceJob(
        trace,
        id,
        [Keys.affectedPackages],
        tool === 'pnpm'
          ? `package has scripts.build; planned: pnpm -C <repo> --filter ${pkg} run build`
          : `package has scripts.build; planned: npm -w ${cwdRel} run build`
      );
    }

    if (p.scripts?.test) {
      const cacheKey = sha256Text(JSON.stringify({ kind: 'test', pkg, tool, changedFiles })).slice(0, 24);
      const id = jobId('test', pkg);
      const exec =
        tool === 'pnpm'
          ? { command: 'pnpm', args: ['-C', repoModel.repoRoot, '--filter', pkg, 'run', 'test'] }
          : { command: 'npm', args: ['-w', cwdRel, 'run', 'test'] };
      testPlan.push({
        id,
        kind: 'test',
        package: pkg,
        cwdRel,
        exec,
        cacheKey
      });
      traceJob(
        trace,
        id,
        [Keys.affectedPackages],
        tool === 'pnpm'
          ? `package has scripts.test; planned: pnpm -C <repo> --filter ${pkg} run test`
          : `package has scripts.test; planned: npm -w ${cwdRel} run test`
      );
    }
  }

  traceDerived(trace, Keys.buildPlan, [Keys.affectedPackages], 'one build job per affected package that has scripts.build');
  traceDerived(trace, Keys.testPlan, [Keys.affectedPackages], 'one test job per affected package that has scripts.test');

  return {
    changedFiles,
    affectedPackages,
    buildPlan,
    testPlan,
    trace
  };
}
