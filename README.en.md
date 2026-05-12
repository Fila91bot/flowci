# FlowCI – Monorepo Change Impact Builder

FlowCI is a **flow-based execution architecture** for CI/CD planning and execution:

- **Dataflow defines execution**: what runs is a function of data (`changed.files` → `affected.packages` → `build.plan` → `test.plan`).
- **Nodes localize responsibility**: each node has a strict input/output contract (relevant-only).
- **Observability shows cause & effect**: every decision has a “why” chain, not just logs.
- **Capability boundaries emerge from architecture**: an internet node must not install; an install node must not use the internet.

This is a real tool (not a UI demo) that runs on an actual monorepo and produces:

- a minimal build/test plan for a given change set
- deterministic planning (same input → same plan)
- enforceable capability separation
- artifacts/cache as part of the flow, not incidental log side effects

## The problem

Typical monorepo CI pain points:

- too much work (“run everything” because impact analysis is hard)
- hand-maintained job matrices
- poor causality (“what ran” is visible; “why” is not)
- privilege soup (a runner that can do everything is inherently risky)

FlowCI improves this by:

- building/testing only affected packages
- making the plan a graph + data, not YAML heuristics
- producing explainable “why” traces for every planned job/key
- making capability separation a structural constraint

## Core concepts

### Data keys (the contract)

Nodes read/write only explicit keys.

Examples:

- `changed.files`
- `repo.packages`
- `repo.deps` (package graph)
- `affected.packages`
- `build.plan`
- `test.plan`
- `report.summary`

Rule: we do **not** pass full history; we pass only relevant keys.

### Node = responsibility unit

Node definition:

- `inputs[]`: keys it may read
- `outputs[]`: keys it may emit
- `capabilities`: e.g. `internet` **or** `install` (or default offline)
- `shouldRun`: declarative gate (“skip if empty”)

### Capability separation (hard rule)

Minimum:

- `internet` node: may fetch metadata, but must not install/build
- `install` node: may install/build, but must not access the internet

Others are offline by default.

### Observability = cause → effect

FlowCI records:

- why a key exists (derived from which inputs)
- why a job is planned (derived from which keys)

So you can answer:

> “This build job ran because `changed.files` touched `packages/ui/*` → `affected.packages` includes `ui` → `build.plan` contains `ui`.”

## What it does (MVP)

### 1) Repository model

Supported layout (pragmatic):

- `packages/*/package.json`

It generates:

- `repo.packages`
- `repo.deps` (internal dependency edges)

### 2) Impact analysis

Input:

- `changed.files` (git diff or manual list)

Output:

- `affected.packages` (directly touched + reverse dependency closure)

### 3) Planning

From `affected.packages` FlowCI produces:

- `build.plan`: one build job per affected package with `scripts.build`
- `test.plan`: one test job per affected package with `scripts.test`

### 4) Execution (included)

FlowCI can execute the plan and uses a minimal cache to skip repeated work (cache key stability).

## Commands

- `flowci scan`
- `flowci plan`
- `flowci run`
- `flowci explain`

For exact commands and paths in this repo, see `QUICKSTART.md`.

## Success criteria (“better than today’s CI”)

- fewer planned jobs vs “run all”
- deterministic output for the same change set
- enforceable rule: no node can be both `internet` and `install`
- explainability: every planned job/key has a “why” trace

## Docs

- Hrvatski: `README.md`, `struktura-projekta.md`
- English: `README.en.md`, `struktura-projekta.en.md`
- Quick start: `QUICKSTART.md`

