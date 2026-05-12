export type TraceReason =
  | { type: 'source'; note: string }
  | { type: 'derived'; fromKeys: string[]; note: string };

export type KeyTrace = { key: string; reason: TraceReason };

export type JobTrace = {
  jobId: string;
  fromKeys: string[];
  note: string;
  dependencyChain?: string[];
};

export type Trace = {
  keys: Record<string, KeyTrace>;
  jobs: Record<string, JobTrace>;
  packages?: Record<string, { package: string; dependencyChain: string[] }>;
};

export function newTrace(): Trace {
  return { keys: {}, jobs: {} };
}

export function traceSource(t: Trace, key: string, note: string) {
  t.keys[key] = { key, reason: { type: 'source', note } };
}

export function traceDerived(t: Trace, key: string, fromKeys: string[], note: string) {
  t.keys[key] = { key, reason: { type: 'derived', fromKeys, note } };
}

export function traceJob(t: Trace, jobId: string, fromKeys: string[], note: string) {
  t.jobs[jobId] = { jobId, fromKeys, note };
}

export function tracePackageChain(t: Trace, pkg: string, dependencyChain: string[]) {
  if (!t.packages) t.packages = {};
  t.packages[pkg] = { package: pkg, dependencyChain };
}
