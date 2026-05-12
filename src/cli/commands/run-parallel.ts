import { spawnSync } from 'node:child_process';
import { cmdPlan } from './plan';
import { ensureDir, readJsonIfExists, writeJson } from '../../utils/fs';
import { FlowPlan } from '../../planner/types';
import { RepoModel } from '../../repo/types';
import { createCacheStore } from '../../storage/cache-store';
import { sha256Text } from '../../utils/hash';
import { jobLayers, runJobsParallel, printLayerSummary } from '../../runner/parallel';

export async function cmdRunParallel(opts: {
  repo: string;
  outDir: string;
  base: string;
  head: string;
  changed: string;
  maxConcurrency?: number;
}) {
  const { repo, outDir, base, head, changed } = opts;
  await ensureDir(outDir);

  // Ensure plan exists and is up to date for this diff.
  await cmdPlan({ repo, outDir, base, head, changed });

  const plan = await readJsonIfExists<FlowPlan>(`${outDir}/plan.json`);
  if (!plan) throw new Error('Missing plan.json');

  const repoModel = await readJsonIfExists<RepoModel>(`${outDir}/repo.json`);
  if (!repoModel) throw new Error('Missing repo.json; run `flowci scan` first');

  const cache = createCacheStore({ dir: `${outDir}/cache` });
  await cache.ensure();

  // Ispis informacija
  const layers = jobLayers(repoModel, plan);
  console.log(`\n⚡ Parallel execution: ${layers.length} layer(s), ${plan.buildPlan.length + plan.testPlan.length} total jobs\n`);

  const runId = sha256Text(JSON.stringify({ changed: plan.changedFiles, affected: plan.affectedPackages })).slice(0, 12);
  const runLog: Array<{
    jobId: string;
    kind: 'build' | 'test';
    layer: number;
    skipped?: boolean;
    success: boolean;
    cacheHit?: boolean;
    duration: number;
  }> = [];

  let allOk = true;
  let totalTime = 0;

  // Izvrši svaki layer paralelno
  for (let i = 0; i < layers.length; i++) {
    const layer = layers[i];
    const layerStart = Date.now();

    console.log(`\n▶️  Layer ${i + 1}/${layers.length} (${layer.length} jobs parallel)`);
    const results = await runJobsParallel(layer, repo, cache);
    const layerDuration = Date.now() - layerStart;
    totalTime += layerDuration;

    // Obradi rezultate
    for (const result of results) {
      const job = layer.find(j => j.id === result.jobId)!;
      const isCached = result.duration === 0;

      runLog.push({
        jobId: result.jobId,
        kind: job.kind,
        layer: i + 1,
        success: result.ok,
        skipped: isCached,
        cacheHit: isCached,
        duration: result.duration
      });

      if (!result.ok) {
        allOk = false;
      }
    }

    // Ispis summary za layer
    const { allOk: layerOk } = printLayerSummary(i + 1, layers.length, results, layerStart);

    // Ako je layer failao, preskoči ostale
    if (!layerOk) {
      console.log(`\n❌ Layer ${i + 1} failed, stopping\n`);
      allOk = false;
      break;
    }
  }

  // Spremi log
  await writeJson(
    `${outDir}/runs/${runId}.json`,
    {
      runId,
      ok: allOk,
      mode: 'parallel',
      layers: layers.length,
      log: runLog
    },
    { pretty: true }
  );

  console.log(`\n📊 Summary`);
  console.log(`   Total time: ${(totalTime / 1000).toFixed(1)}s`);
  console.log(`   Layers: ${layers.length}`);
  console.log(`   Jobs: ${plan.buildPlan.length + plan.testPlan.length}`);
  console.log(`   Status: ${allOk ? '✅ all passed' : '❌ failed'}`);
  console.log(`📦 wrote ${outDir}/runs/${runId}.json\n`);

  if (!allOk) process.exitCode = 1;
}
