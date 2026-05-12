export type ExecSpec = { command: string; args: string[] };

export type PlannedJob = {
  id: string;
  kind: 'build' | 'test';
  package: string;
  cwdRel?: string;
  exec: ExecSpec;
  cacheKey: string;
};

export type Trace = import('../flow/trace').Trace;

export type FlowPlan = {
  changedFiles: string[];
  affectedPackages: string[];
  buildPlan: PlannedJob[];
  testPlan: PlannedJob[];
  trace: Trace;
};

