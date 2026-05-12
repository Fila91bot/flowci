# Project structure: FlowCI (Monorepo Change Impact Builder)

This document defines a modular structure for a real program (not a demo) where:

- dataflow keys drive the design
- nodes have clear responsibilities
- observability is built-in (cause → effect)
- capability separation is a hard architectural constraint

## High-level overview

Three layers:

1) **Repository model** (scan + graph)
2) **Planner** (impact → plan)
3) **Runner/Executor** (plan execution)

Cross-cutting:

- **Observability/Trace** (why/explain)
- **Storage** (cache + artifacts)

## Proposed folder layout

```
flowci/
  README.md
  README.en.md
  QUICKSTART.md
  struktura-projekta.md
  struktura-projekta.en.md

  src/
    cli/
      main.ts
      commands/
        scan.ts
        plan.ts
        run.ts
        explain.ts

    flow/
      keys.ts
      trace.ts

    repo/
      types.ts
      scan/
        index.ts
        package-json.ts
      scan.ts

    changes/
      git-diff.ts
      normalize-paths.ts

    planner/
      plan.ts
      types.ts

    storage/
      cache-store.ts

  examples/
    sample-monorepo/
      packages/
        a/
        b/
```

## Dataflow contract

### `flow/keys.ts`

Central key registry (string constants). Minimal set:

- `changed.files: string[]`
- `repo.packages`
- `repo.deps`
- `affected.packages`
- `build.plan`
- `test.plan`

Why it matters:

- enforces “relevant-only” data passing
- makes causality explainable (data edges)

## Capability separation

The design goal is to enforce:

- no node can be both `internet` and `install`

In the current MVP, this is expressed as a concept in docs and traces (planning/explainability).
A next step is to formalize capabilities per node and run them in separated sandboxes.

## Observability (cause → effect)

### `flow/trace.ts`

Trace model:

- key provenance (`source` vs `derived`, including which inputs)
- job provenance (which key(s) led to job creation)

### `cli explain`

Two views:

- `--job <id|package>`: why the job exists
- `--key <name>`: why the key exists

## Repo scanning and graph

### `repo/scan/*`

Responsibilities:

- discover workspace packages (default: `packages/*/package.json`)
- parse `name`, `scripts`, and dependency fields
- build internal dependency edges (`repo.deps`)

## Impact analysis

### `planner/plan.ts`

Algorithm:

- map file → package by most-specific directory prefix match
- compute reverse-dependency closure to include downstream packages

## Planning build/test jobs

### `planner/plan.ts`

Rules (MVP):

- if a package has `scripts.build` → one build job
- if a package has `scripts.test` → one test job

## Storage (cache)

### `storage/cache-store.ts`

Minimal content-addressed cache:

- key = stable hash of `{ kind, package, command, changedFiles }`
- used to skip repeated work in `flowci run`

