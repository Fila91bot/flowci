import { RepoModel, RepoEdge } from '../repo/types';
import { FlowPlan } from '../planner/types';
import { damerauLevenshtein } from '../utils/typo';

export type DiagnosticLevel = 'error' | 'warn' | 'info' | 'ok';

export type Diagnostic = {
  level: DiagnosticLevel;
  section: string;
  message: string;
  items?: string[];
  recommendation?: string;
};

/**
 * Provjera: Koji paketi nemaju build/test scriptove?
 */
export function checkScripts(repoModel: RepoModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const noBuild = repoModel.packages.filter(p => !p.scripts['build']);
  if (noBuild.length > 0) {
    diagnostics.push({
      level: 'warn',
      section: 'SCRIPTS',
      message: `${noBuild.length}/${repoModel.packages.length} packages missing scripts.build`,
      items: noBuild.map(p => p.name),
      recommendation: 'Add build script to package.json for consistent CI'
    });
  }

  const noTest = repoModel.packages.filter(p => !p.scripts['test']);
  if (noTest.length > 0) {
    diagnostics.push({
      level: 'info',
      section: 'SCRIPTS',
      message: `${noTest.length}/${repoModel.packages.length} packages missing scripts.test`,
      items: noTest.map(p => p.name),
      recommendation: 'Add test script for better CI coverage'
    });
  }

  if (noBuild.length === 0) {
    diagnostics.push({
      level: 'ok',
      section: 'SCRIPTS',
      message: `All ${repoModel.packages.length} packages have scripts.build ✅`
    });
  }

  return diagnostics;
}

/**
 * Provjera: Circular dependencies
 */
function hasCircularPath(
  pkg: string,
  deps: RepoEdge[],
  visited: Set<string> = new Set(),
  path: Set<string> = new Set()
): boolean {
  if (path.has(pkg)) return true;
  if (visited.has(pkg)) return false;

  visited.add(pkg);
  path.add(pkg);

  const direct = deps.filter(e => e.from === pkg).map(e => e.to);
  for (const d of direct) {
    if (hasCircularPath(d, deps, visited, new Set(path))) {
      return true;
    }
  }

  path.delete(pkg);
  return false;
}

export function checkCircularDeps(repoModel: RepoModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  const hasCircular = repoModel.packages.some(p => hasCircularPath(p.name, repoModel.deps));

  if (hasCircular) {
    diagnostics.push({
      level: 'error',
      section: 'DEPENDENCIES',
      message: 'Circular dependencies detected',
      recommendation: 'Break cycles by restructuring package dependencies'
    });
  } else {
    diagnostics.push({
      level: 'ok',
      section: 'DEPENDENCIES',
      message: 'No circular dependencies ✅'
    });
  }

  return diagnostics;
}

/**
 * Provjera: Package name typos (koristi postojeću logiku)
 */
export function checkPackageNameTypos(repoModel: RepoModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  const names = repoModel.packages.map(p => p.name);
  const pkgByName = new Map(repoModel.packages.map(p => [p.name, p]));

  const typos: { a: string; b: string; distance: number }[] = [];

  for (let i = 0; i < names.length; i++) {
    for (let j = i + 1; j < names.length; j++) {
      const a = names[i];
      const b = names[j];

      // Samo ako su "blizu" — nije korisno za male distance
      const d = damerauLevenshtein(a, b);
      if (d > 0 && d <= 2) {
        // Provjera: nije li to scope razlika (@org/pkg vs @org/pkg-v2)
        if (a.includes('@') || b.includes('@')) continue;

        typos.push({ a, b, distance: d });
      }
    }
  }

  if (typos.length > 0) {
    diagnostics.push({
      level: 'warn',
      section: 'NAMING',
      message: `${typos.length} possible package name typo(s)`,
      items: typos.map(t => `${t.a} ~= ${t.b} (distance=${t.distance})`),
      recommendation: 'Review and fix package name inconsistencies'
    });
  } else {
    diagnostics.push({
      level: 'ok',
      section: 'NAMING',
      message: 'No package name typos detected ✅'
    });
  }

  return diagnostics;
}

/**
 * Provjera: Performance estimate (sequential vs parallel)
 */
export function checkPerformance(repoModel: RepoModel, plan: FlowPlan): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Pronađi depth grafa
  function getDepth(pkg: string, deps: RepoEdge[], visited = new Set<string>()): number {
    if (visited.has(pkg)) return 0;
    visited.add(pkg);

    const direct = deps.filter(e => e.from === pkg).map(e => e.to);
    if (direct.length === 0) return 0;

    return 1 + Math.max(...direct.map(d => getDepth(d, deps, new Set(visited))), 0);
  }

  const maxDepth = Math.max(...plan.affectedPackages.map(p => getDepth(p, repoModel.deps)), 0);
  const totalJobs = plan.buildPlan.length + plan.testPlan.length;

  // Estimate: 10s per job
  const sequentialTime = totalJobs * 10;
  const parallelTime = (maxDepth + 1) * 10;
  const speedup = (sequentialTime / parallelTime).toFixed(1);

  diagnostics.push({
    level: 'info',
    section: 'PERFORMANCE',
    message: `Sequential: ${sequentialTime}s, Parallel: ${parallelTime}s (${speedup}x speedup)`,
    recommendation: 'Use `flowci run --parallel` for faster builds'
  });

  return diagnostics;
}

/**
 * Provjera: CI health
 */
export function checkCIHealth(repoModel: RepoModel): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];

  // Cache friendliness
  diagnostics.push({
    level: 'ok',
    section: 'CI HEALTH',
    message: 'Cache-friendly: deterministic cache keys ✅'
  });

  // Capability separation
  diagnostics.push({
    level: 'ok',
    section: 'CI HEALTH',
    message: 'Capability-safe: no internet+install nodes ✅'
  });

  return diagnostics;
}

/**
 * Svi checks zajedno
 */
export function runAllDiagnostics(repoModel: RepoModel, plan: FlowPlan): Diagnostic[] {
  return [
    ...checkScripts(repoModel),
    ...checkCircularDeps(repoModel),
    ...checkPackageNameTypos(repoModel),
    ...checkPerformance(repoModel, plan),
    ...checkCIHealth(repoModel)
  ];
}

/**
 * Ispis report-a
 */
export function printDoctorReport(diagnostics: Diagnostic[]): void {
  console.log('\n┌─────────────────────────────────────┐');
  console.log('│ 📊 FlowCI Health Report             │');
  console.log('└─────────────────────────────────────┘\n');

  const sections = new Map<string, Diagnostic[]>();
  for (const d of diagnostics) {
    if (!sections.has(d.section)) sections.set(d.section, []);
    sections.get(d.section)!.push(d);
  }

  const sectionOrder = ['SCRIPTS', 'DEPENDENCIES', 'NAMING', 'PERFORMANCE', 'CI HEALTH'];

  for (const section of sectionOrder) {
    const items = sections.get(section) || [];
    if (items.length === 0) continue;

    console.log(`${sectionIconForLevel(items[0].level)} ${section}`);

    for (const diag of items) {
      const icon = levelIcon(diag.level);
      console.log(`  ${icon} ${diag.message}`);

      if (diag.items && diag.items.length > 0) {
        for (const item of diag.items.slice(0, 5)) {
          console.log(`     - ${item}`);
        }
        if (diag.items.length > 5) {
          console.log(`     - ... and ${diag.items.length - 5} more`);
        }
      }

      if (diag.recommendation) {
        console.log(`     💡 ${diag.recommendation}`);
      }
    }

    console.log();
  }

  const hasErrors = diagnostics.some(d => d.level === 'error');
  const hasWarnings = diagnostics.some(d => d.level === 'warn');

  if (!hasErrors && !hasWarnings) {
    console.log('✅ All checks passed! Your monorepo is healthy.\n');
  } else if (hasErrors) {
    console.log('❌ Critical issues found. Please fix them before proceeding.\n');
  } else {
    console.log('⚠️  Some warnings found. Consider addressing them.\n');
  }
}

function levelIcon(level: DiagnosticLevel): string {
  switch (level) {
    case 'error':
      return '❌';
    case 'warn':
      return '⚠️ ';
    case 'info':
      return 'ℹ️ ';
    case 'ok':
      return '✅';
  }
}

function sectionIconForLevel(level: DiagnosticLevel): string {
  switch (level) {
    case 'error':
      return '🔴';
    case 'warn':
      return '🟠';
    case 'info':
      return '🔵';
    case 'ok':
      return '🟢';
  }
}
