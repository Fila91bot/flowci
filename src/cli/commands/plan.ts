import { cmdScan } from './scan';
import { computeChangedFiles } from '../../changes/git-diff';
import { normalizePaths } from '../../changes/normalize-paths';
import { ensureDir, readJsonIfExists, writeJson } from '../../utils/fs';
import { planFlow } from '../../planner/plan';
import { RepoModel } from '../../repo/types';
import { detectWorkspaceTool } from '../../repo/workspace';

export async function cmdPlan(opts: { repo: string; outDir: string; base: string; head: string; changed: string }) {
  const { repo, outDir, base, head, changed } = opts;
  await ensureDir(outDir);

  let repoModel = await readJsonIfExists<RepoModel>(`${outDir}/repo.json`);
  if (!repoModel) {
    await cmdScan({ repo, outDir });
    repoModel = await readJsonIfExists<RepoModel>(`${outDir}/repo.json`);
  }
  if (!repoModel) throw new Error('Missing repo model; scan failed');

  const changedRaw =
    changed.trim().length > 0
      ? changed.split(',').map(s => s.trim()).filter(Boolean)
      : await computeChangedFiles({ repo, base, head });
  const changedFiles = normalizePaths(repo, changedRaw);

  const tool = await detectWorkspaceTool(repoModel.repoRoot);
  const plan = planFlow({ repo, repoModel, changedFiles, tool });

  await writeJson(`${outDir}/plan.json`, plan, { pretty: true });
  await writeJson(`${outDir}/trace.json`, plan.trace, { pretty: true });

  console.log(`✅ plan: changed=${changedFiles.length} affected=${plan.affectedPackages.length}`);
  console.log(`🧱 buildJobs=${plan.buildPlan.length} testJobs=${plan.testPlan.length}`);
  console.log(`📦 wrote ${outDir}/plan.json`);
  console.log(`🧭 wrote ${outDir}/trace.json`);
}
