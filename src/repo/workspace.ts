import { fileExists } from '../utils/fs';

export type WorkspaceTool = 'pnpm' | 'npm';

export async function detectWorkspaceTool(repoRoot: string): Promise<WorkspaceTool> {
  if (await fileExists(`${repoRoot}/pnpm-workspace.yaml`)) return 'pnpm';
  return 'npm';
}

