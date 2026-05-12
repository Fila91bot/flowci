FlowCI – Monorepo Change Impact Builder
Ultra‑fast, deterministic CI engine for monorepos.
No YAML. No config. No AI.
Plans in 0–10 ms, executes in parallel, explains every decision.

FlowCI:

detects changed files

computes affected packages

generates minimal build/test plan

executes sequentially or in parallel

provides full “why” explanations

performs monorepo health checks

uses deterministic cache keys

runs in milliseconds

🚀 Quick Start
Scan your monorepo

npx flowci scan --repo .
Check monorepo health

npx flowci doctor --repo .
Generate a build/test plan

npx flowci plan --repo . --changed "packages/core/src/index.ts"
Run in parallel (5–10× faster)

npx flowci run --repo . --parallel --changed "packages/core/src/index.ts"
Explain why a job exists

npx flowci explain --job build:@myorg/core
⚡ Example: Parallel Execution

⚡ Parallel execution: 1 layer(s), 11 total jobs

⏭️  build @material-tailwind/react (cache hit)
⏭️  build material-tailwind-cra (cache hit)
⏭️  build material-tailwind-next (cache hit)
... (8 more)

Layer 1/1 (11 jobs) — 9ms
cached: 11
11 jobs in 9ms.  
Zero config. Zero YAML. Zero overhead.

🧠 What FlowCI Solves
“run everything” problem in monorepos

slow sequential builds

manual CI job matrices

lack of causality (“why did this run?”)

wasted CI time and CPU cost

FlowCI runs only what is affected — nothing more.

🟦 Commands
flowci scan
Scans packages and builds the dependency graph.

flowci doctor
Monorepo health check (scripts, naming, cycles, performance, cache safety).

flowci plan
Generates build/test plan and trace.

flowci run
Executes the plan sequentially.

flowci run --parallel
Executes by dependency layers (parallelized).

flowci explain
Explains why each job exists (causal chain).

🧩 How It Works
Deterministic flow
changed.files → affected.packages → build.plan

dependency graph defines execution layers

parallel execution per layer

cache hits skip jobs

explain shows full causal chain

Zero‑config philosophy
FlowCI reads your monorepo structure — no YAML, no config files, no heuristics.

📦 Installation
Local install

npm install -D flowci
Or use via npx

npx flowci --help
🏁 CI/CD Example (GitHub Actions)

- run: npx flowci scan --repo .
- run: npx flowci plan --repo . --base origin/main --head HEAD
- run: npx flowci run --repo . --parallel
📚 Documentation
README.md – basic guide

QUICKSTART.md – quick start

docs/architecture.md – architecture

docs/future.md – future direction

🟢 Status
FlowCI v0.1.0 is production‑ready.

scan ✔️

plan ✔️

run ✔️

parallel executor ✔️

doctor ✔️

explain ✔️

deterministic cache keys ✔️

ultra‑fast planning (0–10 ms) ✔️

🌍 Open Source
Publish to npm

npm version 0.1.0
npm publish

Use

npx flowci scan --repo .
npx flowci doctor --repo .
npx flowci run --repo . --parallel
