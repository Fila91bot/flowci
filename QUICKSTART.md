# FlowCI – Quick Start

## Preduvjeti

- Node.js 16+
- npm ili pnpm

## Instalacija

```bash
npm i -D ./flowci
# ili ako je već published na npm:
npm i -D flowci
```

## 1️⃣ Skenira tvoj monorepo

```bash
npx flowci scan --repo . --out .flowci
```

**Output:**
```
✅ scan: packages=11 edges=8
📦 wrote .flowci/repo.json
```

Trebao bi vidjeti broj paketa i dependency veza.

---

## 2️⃣ Provjeri zdravlje monorepo-a

```bash
npx flowci doctor --repo . --out .flowci
```

**Output:**
```
┌─────────────────────────────────────┐
│ 📊 FlowCI Health Report             │
└─────────────────────────────────────┘

🔵 SCRIPTS
  ℹ️  9/11 packages missing scripts.test
     💡 Add test script for better CI coverage

🟢 DEPENDENCIES
  ✅ No circular dependencies ✅

🟠 NAMING
  ⚠️  1 possible package name typo
     💡 Review and fix package name inconsistencies

🔵 PERFORMANCE
  ℹ️  Sequential: 110s, Parallel: 20s (5.5x speedup)
     💡 Use `flowci run --parallel` for faster builds

🟢 CI HEALTH
  ✅ Cache-friendly: deterministic cache keys ✅
  ✅ Capability-safe: no internet+install nodes ✅

⚠️  Some warnings found. Consider addressing them.
```

---

## 3️⃣ Generiraj build plan

### Opcija A: Ručno navedi promijenjene datoteke

```bash
npx flowci plan --repo . --changed "packages/core/src/index.ts"
```

### Opcija B: Koristi git diff (ako je git repo)

```bash
npx flowci plan --repo . --base origin/main --head HEAD
```

**Output:**
```
✅ plan: changed=1 affected=9
🧱 buildJobs=9 testJobs=2
📦 wrote .flowci/plan.json
🧭 wrote .flowci/trace.json
```

To znači:
- Promijenuo si 1 datoteku
- **9 paketa** je pogođeno (direktno ili transitively)
- Trebam buildati **9 paketa** i testirati **2**

---

## 4️⃣ Pogledaj što će se pokrenuti (explain)

```bash
# Sve jobove kao DAG
npx flowci explain --out .flowci --all --format ascii

# Specifičan job
npx flowci explain --out .flowci --job build:@material-tailwind/react

# Specifičan ključ
npx flowci explain --out .flowci --key affected.packages
```

**Output (--all):**
```
┌──────────┐
│ jobs: 11 │
│ build: 9 │
│ test: 2  │
└──────────┘

DAG (package -> dependency):
material-tailwind-cra -> @material-tailwind/react
material-tailwind-next -> @material-tailwind/react
...

Jobs:
- build:@material-tailwind/react
  chain: @material-tailwind/react
- build:material-tailwind-cra
  chain: material-tailwind-cra -> @material-tailwind/react
...
```

Vidimo:
- **DAG** — dependency graf
- **chain** — zašto je paket pogođen (dependency lanac)

---

## 5️⃣ Izvrši plan SEKVENCIJALNO

```bash
npx flowci run --repo . --changed "packages/core/src/index.ts"
```

**Output:**
```
▶️ build @material-tailwind/react
✅ done (12s)

▶️ build material-tailwind-cra
✅ done (8s)

▶️ build material-tailwind-next
✅ done (7s)

📦 wrote .flowci/runs/xxxxx.json
```

---

## 6️⃣ Izvrši plan PARALELNO ⚡ (BRŽE!)

```bash
npx flowci run --repo . --parallel --changed "packages/core/src/index.ts"
```

**Output:**
```
⚡ Parallel execution: 2 layer(s), 11 total jobs

▶️  Layer 1/2 (1 job parallel)
▶️  build @material-tailwind/react
✅ Layer 1/2 (1 jobs) — 12000ms

▶️  Layer 2/2 (8 jobs parallel)
▶️  build material-tailwind-cra
▶️  build material-tailwind-next
▶️  build material-tailwind-remix
▶️  build material-tailwind-remix-ts
▶️  build material-tailwind-vite
▶️  build material-tailwind-vite-ts
▶️  build material-tailwind-cra-ts
▶️  build material-tailwind-next-ts
✅ Layer 2/2 (8 jobs) — 18000ms

📊 Summary
   Total time: 30.0s
   Layers: 2
   Jobs: 11
   Status: ✅ all passed
📦 wrote .flowci/runs/xxxxx.json
```

**Što je razlika?**
- Sekvencijalno: ~45s (jobovi jedan po jedan)
- Paralelno: ~30s (8 jobova istovremeno u layer 2)
- **Speedup: 1.5x** 🚀

Na većim monorepo-ima mogu biti **5-10x brži**!

---

## 7️⃣ Koristi cache (ponovi istu komandu)

```bash
npx flowci run --repo . --parallel --changed "packages/core/src/index.ts"
```

**Output (drugi put):**
```
⚡ Parallel execution: 2 layer(s), 11 total jobs

▶️  Layer 1/2 (1 job parallel)
⏭️  build @material-tailwind/react (cache hit)  ← SKIP!
✅ Layer 1/2 done (0ms)

▶️  Layer 2/2 (8 jobs parallel)
⏭️  build material-tailwind-cra (cache hit)     ← SKIP!
⏭️  build material-tailwind-next (cache hit)    ← SKIP!
...
✅ Layer 2/2 done (0ms)

📊 Summary
   Total time: 0.1s
   Status: ✅ all passed (8 cache hits!)
```

**Ohhhh!** Svi jobovi su skippani jer je input identičan. Cache radi! 🎉

---

## 📋 Kompletan workflow (copy/paste)

```bash
# 1. Setup
npx flowci scan --repo .

# 2. Health check
npx flowci doctor --repo .

# 3. Plan za promjenu (ručno)
npx flowci plan --repo . --changed "packages/core/src/index.ts"

# 4. Pogledaj zašto (optional)
npx flowci explain --out .flowci --all --format ascii

# 5. Izvrši PARALELNO
npx flowci run --repo . --parallel --changed "packages/core/src/index.ts"

# 6. Ponovi — vidjet ćeš cache hitove!
npx flowci run --repo . --parallel --changed "packages/core/src/index.ts"
```

---

## 🚀 Za CI/CD (GitHub Actions)

```yaml
name: FlowCI

on: [pull_request, push]

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
        with:
          fetch-depth: 0
      
      - uses: actions/setup-node@v3
        with:
          node-version: 18
      
      - run: npm ci
      
      - run: npx flowci scan --repo . --out .flowci
      
      - run: npx flowci plan --repo . --out .flowci --base origin/main --head HEAD
      
      - run: npx flowci run --repo . --parallel --out .flowci --base origin/main --head HEAD
      
      - uses: actions/upload-artifact@v3
        if: always()
        with:
          name: flowci-report
          path: .flowci/
```

---

## 📚 Dokumentacija

- **README.md** — Puno detaljno
- **struktura-projekta.md** — Arhitektura (za dev)
- Ova datoteka — Quick start (copy/paste)

---

## 🐛 Ako nešto ne radi

```bash
# Debug — vidi što je u planu
cat .flowci/plan.json | jq .

# Vidi repo model
cat .flowci/repo.json | jq '.packages | map({name, scripts: .scripts | keys})'

# Vidi trace (zašto je job u planu)
cat .flowci/trace.json | jq .
```

---

## ✨ Best practices

1. **Pokreni `doctor` prvo** — zna te li kakve probleme u monorepou
2. **Koristi `--parallel`** — 5-10x brži build
3. **Cache je automatski** — isti input = cache hit
4. **Provjeri `explain`** — razumij zašto je job u planu

---

**Sretno!** 🚀
