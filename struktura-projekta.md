# Struktura projekta: Monorepo Change Impact Builder (FlowCI)

Ovaj dokument definira **modularnu strukturu** za “pravi” program (ne demo) tako da:

- dataflow ugovor (keys) vodi dizajn
- nodeovi imaju jasne odgovornosti
- observability je ugrađena (cause → effect)
- capability separation je dizajnerski constraint (ne naknadna politika)

## High-level pregled

Program se sastoji od 3 sloja:

1) **Model repozitorija** (scan + graf)
2) **Planner** (impact → plan)
3) **Runner/Executor** (opcionalno u MVP-u; kasnije)

I dvije poprečne teme:

- **Observability/Trace** (event log + explain)
- **Storage** (cache + artifacts)

## Predložena mapa

> Namjerno bez detalja o build toolchainu; ovo je struktura i ugovori.

```
flowci/
  README.md
  struktura-projekta.md

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
      node.ts
      engine.ts
      capabilities.ts
      trace.ts

    repo/
      scan/
        index.ts
        package-json.ts
        workspace-detect.ts
      graph/
        deps.ts
        reverse-deps.ts
      types.ts

    changes/
      git-diff.ts
      normalize-paths.ts
      types.ts

    planner/
      affected.ts
      build-plan.ts
      test-plan.ts
      cache-keys.ts
      explain.ts
      types.ts

    runner/
      execute.ts
      sandbox/
        internet-node.ts
        install-node.ts
        offline-node.ts
      types.ts

    storage/
      cache-store.ts
      artifact-store.ts
      types.ts

    formats/
      plan-json.ts
      trace-json.ts

  examples/
    sample-monorepo/
      packages/
        a/
        b/
        c/
```

## Dataflow ugovor

### `flow/keys.ts`

Centralni popis ključeva (string constants) + tipovi vrijednosti.

Minimalni set za monorepo impact:

- `changed.files: string[]`
- `repo.packages: { name: string; dir: string }[]`
- `repo.deps: { from: string; to: string }[]` (directed edges)
- `affected.packages: string[]`
- `build.plan: { package: string; command: string; cacheKey: string }[]`
- `test.plan: { package: string; command: string; cacheKey: string }[]`
- `cache.keys: Record<string, string>`
- `report.summary: { planned: number; skipped: number; reasons: Record<string,string> }`

Zašto je ovo bitno:

- “relevant-only” se automatski enforce-a: node ne može čitati/pisati ništa izvan ugovora
- observability dobije jasne “data edges” između nodova

### `flow/node.ts`

Definicija noda (ugovor):

- `id`, `name`
- `deps[]` (minimalna orkestracija)
- `inputs[]`, `outputs[]` (dataflow)
- `capabilities` (`internet | install | offline`)
- `shouldRun(ctx, snapshot)` (declarative gating)
- `run(ctx)` (emitira samo outputs)

## Capabilities i sandboxing

### `flow/capabilities.ts`

Hard pravila:

- `internet && install` je invalid
- default je `offline`

### `runner/sandbox/*`

Ovdje se implementira “capability separation” operativno.

MVP može započeti bez OS-level sandboxa, ali sa strogim pravilima u kodu:

- internet nodovi smiju koristiti samo module koji su označeni kao “network adapters”
- install/build/test nodovi koriste “preuzete” inpute iz storagea

Kasnije:

- stvarni sandbox (container/namespace/firejail) je plug-in iza istog interfejsa

## Observability (cause → effect)

### `flow/trace.ts`

Event model:

- `node.started` (timestamp, nodeId, inputKeys)
- `node.skipped` (timestamp, nodeId, reason, gateInputs)
- `node.completed` (timestamp, nodeId, success, outputKeys)

Ključno:

- svaki output key dobije “provenance”: koji node ga je emitirao i od kojih input key-eva je nastao

### `planner/explain.ts`

`explain(key)` vrati:

- chain: `changed.files` → `affected.packages` → `build.plan` → job
- minimalni skup dokaza (data, ne log)

## Repo scanning i graf

### `repo/scan/*`

Odgovornost:

- pronađi pakete
- pročitaj manifest (prvo `package.json`)
- detektiraj workspace (pnpm/yarn/npm)

### `repo/graph/*`

Odgovornost:

- napravi graf internal dependencija
- reverse deps (za impact propagaciju)

## Impact analiza

### `planner/affected.ts`

Ulaz:

- `changed.files`
- `repo.packages`, `repo.deps`

Izlaz:

- `affected.packages`

Algoritam:

- mapiranje file→package (najduži prefiks direktorija)
- closure po reverse deps

## Planiranje build/test jobova

### `planner/build-plan.ts` + `planner/test-plan.ts`

Ulaz:

- `affected.packages`
- repo metadata (npr. package scripts)

Izlaz:

- `build.plan`, `test.plan`

Pravila (pragmatično za start):

- “ako paket ima `scripts.build` → u plan”
- “ako paket ima `scripts.test` → u plan”
- root-level alati (npr. `pnpm -r`) se modeliraju kao jobovi nad paket setom

## Cache i artefakti

### `storage/cache-store.ts`

Content-addressed store:

- key = hash(input data + toolchain version + command)
- vrijednost = path na build output / test report

### `storage/artifact-store.ts`

Pohrana paketa/artefakata:

- manifest s digestom
- read-only ulaz za deploy/promotion nodove

## “MVP bez izvršavanja”

Ako želiš prvo dokazati vrijednost bez runnanja build/test naredbi:

- implementira se `scan` + `plan` + `explain`
- runner samo “simulira” execute i logira plan
- dobitak se vidi: broj jobova, objašnjenja, capability mapa

To je najbrži put do “ovo je ozbiljno i bolje”.

## Deliverables (što mora postojati u prvom pravom release-u)

- `flowci plan`: generira plan u JSON + trace
- `flowci explain`: objasni “zašto” za bilo koji job ili key
- validacija capability-ja: nema `internet+install`
- deterministični output: isti diff → isti plan
