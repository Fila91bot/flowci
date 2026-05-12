function normalizeName(name: string) {
  // Drop scope, keep just package part for similarity checks.
  const noScope = name.includes('/') && name.startsWith('@') ? name.split('/').slice(1).join('/') : name;
  return noScope.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function commonPrefixLen(a: string, b: string) {
  const n = Math.min(a.length, b.length);
  let i = 0;
  while (i < n && a[i] === b[i]) i++;
  return i;
}

// Damerau–Levenshtein distance (optimal string alignment variant).
// Good enough for short package-name typos (including adjacent transpositions).
export function damerauLevenshtein(aRaw: string, bRaw: string) {
  const a = normalizeName(aRaw);
  const b = normalizeName(bRaw);

  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  const dp: number[][] = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      let best = Math.min(
        dp[i - 1][j] + 1, // deletion
        dp[i][j - 1] + 1, // insertion
        dp[i - 1][j - 1] + cost // substitution
      );

      if (
        i > 1 &&
        j > 1 &&
        a[i - 1] === b[j - 2] &&
        a[i - 2] === b[j - 1]
      ) {
        best = Math.min(best, dp[i - 2][j - 2] + 1); // transposition
      }

      dp[i][j] = best;
    }
  }

  return dp[a.length][b.length];
}

export type SimilarNameWarning = {
  type: 'similar-package-names';
  a: string;
  b: string;
  distance: number;
  aPackageJsonPath?: string;
  bPackageJsonPath?: string;
};

export type PrefixOutlierWarning = {
  type: 'prefix-outlier';
  name: string;
  expectedPrefix: string;
  actualPrefix: string;
  distance: number;
  packageJsonPath?: string;
};

export function findSimilarPackageNames(names: string[]) {
  const out: SimilarNameWarning[] = [];
  const sorted = [...names].sort((x, y) => x.localeCompare(y));

  for (let i = 0; i < sorted.length; i++) {
    for (let j = i + 1; j < sorted.length; j++) {
      const a = sorted[i];
      const b = sorted[j];

      const naN = normalizeName(a);
      const nbN = normalizeName(b);

      // Fast prefilter: only compare when normalized length is close and names are non-trivial.
      const na = naN.length;
      const nb = nbN.length;
      if (Math.abs(na - nb) > 2) continue;
      if (Math.min(na, nb) < 8) continue;

      // Avoid noisy matches: require a meaningful shared prefix (e.g. "materialtailwind...").
      const pref = commonPrefixLen(naN, nbN);
      if (pref < 6) continue;

      const d = damerauLevenshtein(a, b);
      if (d <= 1) out.push({ type: 'similar-package-names', a, b, distance: d });
    }
  }

  return out;
}

export function findPrefixOutliers(names: string[], opts?: { prefixLen?: number; minSupport?: number; maxDistance?: number }) {
  const prefixLen = opts?.prefixLen ?? 12;
  const minSupport = opts?.minSupport ?? 3;
  const maxDistance = opts?.maxDistance ?? 2;

  const normalized = names.map(n => ({ raw: n, norm: normalizeName(n) }));
  const freq = new Map<string, number>();

  for (const n of normalized) {
    const p = n.norm.slice(0, prefixLen);
    if (p.length < Math.min(8, prefixLen)) continue;
    freq.set(p, (freq.get(p) ?? 0) + 1);
  }

  const common = Array.from(freq.entries())
    .filter(([, c]) => c >= minSupport)
    .sort((a, b) => b[1] - a[1])
    .map(([p]) => p);

  const warnings: PrefixOutlierWarning[] = [];
  if (common.length === 0) return warnings;

  for (const n of normalized) {
    const actual = n.norm.slice(0, prefixLen);
    if (actual.length < Math.min(8, prefixLen)) continue;
    if (freq.get(actual) && (freq.get(actual) ?? 0) >= minSupport) continue;

    let best: { prefix: string; d: number } | null = null;
    for (const p of common) {
      const d = damerauLevenshtein(actual, p);
      if (!best || d < best.d) best = { prefix: p, d };
      if (best.d === 0) break;
    }

    if (best && best.d > 0 && best.d <= maxDistance) {
      warnings.push({
        type: 'prefix-outlier',
        name: n.raw,
        expectedPrefix: best.prefix,
        actualPrefix: actual,
        distance: best.d
      });
    }
  }

  // de-dupe by name
  const seen = new Set<string>();
  return warnings.filter(w => (seen.has(w.name) ? false : (seen.add(w.name), true)));
}
