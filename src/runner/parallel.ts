import { RepoModel, RepoEdge } from '../repo/types';
import { PlannedJob, FlowPlan } from '../planner/types';

/**
 * Pronalazi sve pakete od kojih paket `pkg` ovisi (direktno i indirektno)
 */
function findDependencies(pkg: string, deps: RepoEdge[], visited = new Set<string>()): Set<string> {
  if (visited.has(pkg)) return visited;
  visited.add(pkg);

  const direct = deps.filter(e => e.from === pkg).map(e => e.to);
  for (const d of direct) {
    findDependencies(d, deps, visited);
  }

  return visited;
}

/**
 * Grupira jobove u "layers" gdje je svaki layer paralelizabilan
 * Layer 0: jobovi bez dependencija
 * Layer 1: jobovi čije dependencije su sve završene (layer 0)
 * itd.
 */
export function jobLayers(
  repoModel: RepoModel,
  plan: FlowPlan
): PlannedJob[][] {
  const layers: PlannedJob[][] = [];
  const processedPackages = new Set<string>();

  // Hajde dok ne procesiramo sve affected pakete
  while (processedPackages.size < plan.affectedPackages.length) {
    const currentLayer: PlannedJob[] = [];

    for (const pkg of plan.affectedPackages) {
      // Ako je paket već obrađen, preskoči
      if (processedPackages.has(pkg)) continue;

      // Pronađi sve pakete od kojih ovaj paket ovisi
      const deps = findDependencies(pkg, repoModel.deps);
      deps.delete(pkg); // Ukloni sam paket

      // Provjeri: su li sve dependencije već obrađene?
      const allDepsProcessed = Array.from(deps).every(d => processedPackages.has(d));

      if (allDepsProcessed) {
        // Pronađi sve jobove za ovaj paket u trenutnom layer-u
        const jobsForPkg = [
          ...plan.buildPlan.filter(j => j.package === pkg),
          ...plan.testPlan.filter(j => j.package === pkg)
        ];

        currentLayer.push(...jobsForPkg);
        processedPackages.add(pkg);
      }
    }

    // Ako nismo napravili progress, imamo circular dependency
    if (currentLayer.length === 0) {
      throw new Error(
        `Circular dependency detected. Remaining packages: ${
          plan.affectedPackages.filter(p => !processedPackages.has(p)).join(', ')
        }`
      );
    }

    layers.push(currentLayer);
  }

  return layers;
}

/**
 * Izvršava sve jobove u jednom layer-u paralelno
 * Koristi spawnSync za svaki job
 */
export type JobResult = {
  jobId: string;
  package: string;
  ok: boolean;
  duration: number;
};

export async function runJobsParallel(
  jobs: PlannedJob[],
  repo: string,
  cache: { has: (key: string) => Promise<boolean>; put: (key: string, value: unknown) => Promise<void> }
): Promise<JobResult[]> {
  const { spawnSync } = await import('node:child_process');

  const promises = jobs.map(async (job): Promise<JobResult> => {
    const start = Date.now();

    // Provjeri cache
    const hit = await cache.has(job.cacheKey);
    if (hit) {
      console.log(`⏭️  ${job.kind} ${job.package} (cache hit)`);
      return { jobId: job.id, package: job.package, ok: true, duration: 0 };
    }

    // Izvrši job
    console.log(`▶️  ${job.kind} ${job.package}`);
    const res = spawnSync(job.exec.command, job.exec.args, {
      cwd: repo,
      stdio: 'inherit',
      env: process.env
    });

    const duration = Date.now() - start;
    const ok = res.status === 0;

    if (ok) {
      await cache.put(job.cacheKey, { meta: { kind: job.kind, pkg: job.package } });
    }

    return { jobId: job.id, package: job.package, ok, duration };
  });

  return Promise.all(promises);
}

/**
 * Ispis summary-ja nakon svakog layer-a
 */
export function printLayerSummary(
  layerIndex: number,
  totalLayers: number,
  results: JobResult[],
  startTime: number
): { allOk: boolean } {
  const duration = Date.now() - startTime;
  const failed = results.filter(r => !r.ok);
  const cached = results.filter(r => r.duration === 0);

  const allOk = failed.length === 0;

  console.log(`\n${allOk ? '✅' : '❌'} Layer ${layerIndex}/${totalLayers} (${results.length} jobs) — ${duration}ms`);
  if (cached.length > 0) {
    console.log(`   🚀 cached: ${cached.length}`);
  }
  if (failed.length > 0) {
    console.log(`   ❌ failed: ${failed.map(r => r.jobId).join(', ')}`);
  }

  return { allOk };
}
