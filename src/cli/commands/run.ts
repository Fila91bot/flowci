import { spawnSync } from 'node:child_process';
import { cmdPlan } from './plan';
import { ensureDir, readJsonIfExists, writeJson } from '../../utils/fs';
import { FlowPlan } from '../../planner/types';
import { createCacheStore } from '../../storage/cache-store';
import { sha256Text } from '../../utils/hash';

function runCmd(opts: { cwd: string; command: string; args: string[] }) {
  const res = spawnSync(opts.command, opts.args, {
    cwd: opts.cwd,
    stdio: 'inherit',
    env: process.env
  });
  return { ok: res.status === 0 };
}

export async function cmdRun(opts: { repo: string; outDir: string; base: string; head: string; changed: string }) {
  const { repo, outDir, base, head, changed } = opts;
  await ensureDir(outDir);

  // Ensure plan exists and is up to date for this diff.
  await cmdPlan({ repo, outDir, base, head, changed });

  const plan = await readJsonIfExists<FlowPlan>(`${outDir}/plan.json`);
  if (!plan) throw new Error('Missing plan.json');

  const cache = createCacheStore({ dir: `${outDir}/cache` });
  await cache.ensure();

  const runId = sha256Text(JSON.stringify({ changed: plan.changedFiles, affected: plan.affectedPackages })).slice(0, 12);
  const runLog: Array<{ jobId: string; kind: 'build' | 'test'; skipped?: boolean; success: boolean; cacheHit?: boolean }> = [];

  let allOk = true;

  for (const job of plan.buildPlan) {
    const hit = await cache.has(job.cacheKey);
    if (hit) {
      console.log(`⏭️ build ${job.package} (cache hit)`);
      runLog.push({ jobId: job.id, kind: 'build', success: true, skipped: true, cacheHit: true });
      continue;
    }

    console.log(`▶️ build ${job.package}`);
    const ok = runCmd({ cwd: repo, command: job.exec.command, args: job.exec.args }).ok;
    runLog.push({ jobId: job.id, kind: 'build', success: ok });
    if (!ok) allOk = false;
    await cache.put(job.cacheKey, { meta: { kind: 'build', pkg: job.package } });
    if (!ok) break;
  }

  if (allOk) {
    for (const job of plan.testPlan) {
      const hit = await cache.has(job.cacheKey);
      if (hit) {
        console.log(`⏭️ test ${job.package} (cache hit)`);
        runLog.push({ jobId: job.id, kind: 'test', success: true, skipped: true, cacheHit: true });
        continue;
      }

      console.log(`▶️ test ${job.package}`);
      const ok = runCmd({ cwd: repo, command: job.exec.command, args: job.exec.args }).ok;
      runLog.push({ jobId: job.id, kind: 'test', success: ok });
      if (!ok) allOk = false;
      await cache.put(job.cacheKey, { meta: { kind: 'test', pkg: job.package } });
      if (!ok) break;
    }
  }

  await writeJson(`${outDir}/runs/${runId}.json`, { runId, ok: allOk, log: runLog }, { pretty: true });
  console.log(`📦 wrote ${outDir}/runs/${runId}.json`);

  if (!allOk) process.exitCode = 1;
}
