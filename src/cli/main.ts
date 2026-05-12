#!/usr/bin/env node
import { cmdExplain } from './commands/explain';
import { cmdPlan } from './commands/plan';
import { cmdRun } from './commands/run';
import { cmdRunParallel } from './commands/run-parallel';
import { cmdScan } from './commands/scan';
import { cmdDoctor } from './commands/doctor';

type Command = 'scan' | 'plan' | 'run' | 'explain' | 'doctor';

function usage() {
  console.log(`flowci <command> [options]

Commands:
  scan     Scan monorepo packages and deps
  plan     Compute changed/affected + build/test plan
  run      Execute plan (build/test)
  doctor   Check monorepo health and configuration
  explain  Explain why a key/job exists

Common options:
  --repo <path>     Repo path (default: .)
  --out <path>      Output directory (default: .flowci)

Plan/run options:
  --base <ref>      Git base ref (optional)
  --head <ref>      Git head ref (optional)
  --changed <list>  Override changed files (comma-separated)

Run options:
  --parallel        Execute in parallel by dependency layers

Explain options:
  --job <id|pkg>    Explain a specific job
  --key <name>      Explain a specific key
  --all             Print all jobs as a DAG (ASCII)
  --format <fmt>    json|ascii (default: json)
`);
}

function parseArgs(argv: string[]) {
  const args = [...argv];
  const command = (args.shift() as Command | undefined) ?? undefined;

  const flags: Record<string, string | boolean> = {};
  while (args.length > 0) {
    const a = args.shift()!;
    if (!a.startsWith('--')) {
      flags._ = [String(flags._ ?? ''), a].filter(Boolean).join(' ');
      continue;
    }
    const key = a.slice(2);
    const next = args[0];
    if (!next || next.startsWith('--')) {
      flags[key] = true;
      continue;
    }
    flags[key] = args.shift()!;
  }

  return { command, flags };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));

  if (!command || command === ('help' as any)) {
    usage();
    process.exit(command ? 0 : 1);
  }

  const repo = String(flags.repo ?? '.');
  const outDir = String(flags.out ?? '.flowci');
  const changed = typeof flags.changed === 'string' ? String(flags.changed) : '';
  const format = String(flags.format ?? 'json');
  const all = Boolean(flags.all);
  const parallel = Boolean(flags.parallel);

  try {
    if (command === 'scan') return await cmdScan({ repo, outDir });
    
    if (command === 'plan') {
      return await cmdPlan({
        repo,
        outDir,
        base: String(flags.base ?? ''),
        head: String(flags.head ?? ''),
        changed
      });
    }
    
    if (command === 'run') {
      if (parallel) {
        return await cmdRunParallel({
          repo,
          outDir,
          base: String(flags.base ?? ''),
          head: String(flags.head ?? ''),
          changed
        });
      }
      return await cmdRun({
        repo,
        outDir,
        base: String(flags.base ?? ''),
        head: String(flags.head ?? ''),
        changed
      });
    }
    
    if (command === 'doctor') {
      return await cmdDoctor({ repo, outDir });
    }
    
    if (command === 'explain') {
      return await cmdExplain({
        repo,
        outDir,
        key: String(flags.key ?? ''),
        job: String(flags.job ?? ''),
        all,
        format
      });
    }

    console.error(`Unknown command: ${command}`);
    usage();
    process.exit(1);
  } catch (err) {
    console.error(`\nflowci error: ${(err as Error).message}\n`);
    process.exit(1);
  }
}

main();
