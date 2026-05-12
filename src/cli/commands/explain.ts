import { readJsonIfExists } from '../../utils/fs';
import { FlowPlan } from '../../planner/types';
import { Trace } from '../../flow/trace';
import { boxLines, chainToAscii, dagFromChains } from '../../utils/ascii';

export async function cmdExplain(opts: { repo: string; outDir: string; key: string; job: string; all: boolean; format: string }) {
  const { outDir, key, job, all, format } = opts;

  const plan = await readJsonIfExists<FlowPlan>(`${outDir}/plan.json`);
  const trace = await readJsonIfExists<Trace>(`${outDir}/trace.json`);
  if (!plan || !trace) throw new Error('Missing plan.json/trace.json; run `flowci plan` first');

  const wantsAscii = format === 'ascii';

  if (all) {
    const jobs = [...plan.buildPlan, ...plan.testPlan].sort((a, b) => a.id.localeCompare(b.id));

    const edges: Array<{ from: string; to: string }> = [];
    for (const j of jobs) {
      const chain = trace.packages?.[j.package]?.dependencyChain ?? [j.package];
      // chain is [dependent, ..., directChanged]; edges go left-to-right
      for (let i = 0; i < chain.length - 1; i++) edges.push({ from: chain[i], to: chain[i + 1] });
    }

    if (wantsAscii) {
      console.log(boxLines([`jobs: ${jobs.length}`, `build: ${plan.buildPlan.length}`, `test: ${plan.testPlan.length}`]));
      console.log('\nDAG (package -> dependency):');
      console.log(dagFromChains(edges) || '(no edges)');
      console.log('\nJobs:');
      for (const j of jobs) {
        const chain = trace.packages?.[j.package]?.dependencyChain ?? [j.package];
        console.log(`- ${j.id}`);
        console.log(`  chain: ${chainToAscii(chain)}`);
      }
      return;
    }

    console.log(JSON.stringify({ summary: { jobs: jobs.length, build: plan.buildPlan.length, test: plan.testPlan.length }, edges, jobs }, null, 2));
    return;
  }

  if (job) {
    const allJobs = [...plan.buildPlan, ...plan.testPlan];
    const normalized =
      job.startsWith('build:') || job.startsWith('test:')
        ? job.split(':').slice(1).join(':')
        : job;

    const found = allJobs.find(j => j.id === job || j.package === job || j.id === normalized || j.package === normalized);
    if (!found) throw new Error(`Unknown job: ${job}`);
    const chain = trace.packages?.[found.package]?.dependencyChain;
    if (wantsAscii) {
      const chainText = chainToAscii(chain ?? [found.package]);
      console.log(boxLines([found.id, `cwd: ${found.cwdRel ?? '-'}`, `exec: ${found.exec.command} ${found.exec.args.join(' ')}`]));
      console.log(`\nchain: ${chainText}`);
      console.log(`why: ${trace.jobs[found.id]?.note ?? 'n/a'}`);
      return;
    }

    console.log(JSON.stringify({ job: found, why: trace.jobs[found.id], dependencyChain: chain, dependencyChainText: chainToAscii(chain ?? []) }, null, 2));
    return;
  }

  if (!key) throw new Error('Provide --key <name> or --job <id|package>');
  const why = trace.keys[key];
  if (!why) throw new Error(`Unknown key: ${key}`);
  if (wantsAscii) {
    const r = why.reason;
    if (r.type === 'source') {
      console.log(boxLines([key, `source: ${r.note}`]));
      return;
    }
    console.log(boxLines([key, `derived from: ${r.fromKeys.join(', ')}`, r.note]));
    return;
  }
  console.log(JSON.stringify({ key, why }, null, 2));
}
