import { readJsonIfExists } from '../../utils/fs';
import { RepoModel } from '../../repo/types';
import { FlowPlan } from '../../planner/types';
import { cmdScan } from './scan';
import { cmdPlan } from './plan';
import { runAllDiagnostics, printDoctorReport } from '../../doctor/checks';

export async function cmdDoctor(opts: {
  repo: string;
  outDir: string;
}) {
  const { repo, outDir } = opts;

  // Ensure scan exists
  let repoModel = await readJsonIfExists<RepoModel>(`${outDir}/repo.json`);
  if (!repoModel) {
    console.log('📦 No repo model found, scanning...\n');
    await cmdScan({ repo, outDir });
    repoModel = await readJsonIfExists<RepoModel>(`${outDir}/repo.json`);
  }

  if (!repoModel) throw new Error('Failed to scan repo');

  // Ensure plan exists
  let plan = await readJsonIfExists<FlowPlan>(`${outDir}/plan.json`);
  if (!plan) {
    console.log('📋 No plan found, creating default plan...\n');
    await cmdPlan({ repo, outDir, base: '', head: '', changed: '' });
    plan = await readJsonIfExists<FlowPlan>(`${outDir}/plan.json`);
  }

  if (!plan) throw new Error('Failed to create plan');

  // Run diagnostics
  const diagnostics = runAllDiagnostics(repoModel, plan);

  // Print report
  printDoctorReport(diagnostics);

  // Exit code
  const hasErrors = diagnostics.some(d => d.level === 'error');
  if (hasErrors) process.exitCode = 1;
}
