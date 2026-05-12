export type RepoPackage = {
  name: string;
  dir: string; // absolute
  relDir: string; // repo-relative
  packageJsonPath: string; // absolute
  relPackageJsonPath: string; // repo-relative
  scripts: Record<string, string>;
  internalDeps: string[];
};

export type RepoEdge = { from: string; to: string };

export type RepoModel = {
  repoRoot: string;
  packages: RepoPackage[];
  deps: RepoEdge[];
};
