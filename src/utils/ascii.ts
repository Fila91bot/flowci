export function boxLines(lines: string[], opts?: { indent?: string }) {
  const indent = opts?.indent ?? '';
  const width = Math.max(0, ...lines.map(l => l.length));
  const top = `${indent}┌${'─'.repeat(width + 2)}┐`;
  const body = lines.map(l => `${indent}│ ${l.padEnd(width, ' ')} │`);
  const bottom = `${indent}└${'─'.repeat(width + 2)}┘`;
  return [top, ...body, bottom].join('\n');
}

export function chainToAscii(chain: string[]) {
  if (chain.length === 0) return '';
  if (chain.length === 1) return chain[0];
  return chain.join(' -> ');
}

export function dagFromChains(chains: Array<{ from: string; to: string }>) {
  // Simple ASCII edge list; deterministic ordering.
  const uniq = new Set<string>();
  for (const e of chains) uniq.add(`${e.from} -> ${e.to}`);
  return Array.from(uniq).sort().join('\n');
}

