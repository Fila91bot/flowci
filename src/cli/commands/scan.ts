import { ensureDir, writeJson } from '../../utils/fs';
import { scanRepo } from '../../repo/scan';
import { findPrefixOutliers, findSimilarPackageNames } from '../../utils/typo';

export async function cmdScan(opts: { repo: string; outDir: string }) {
  const { repo, outDir } = opts;
  await ensureDir(outDir);

  const scanned = await scanRepo({ repo });

  await writeJson(`${outDir}/repo.json`, scanned, { pretty: true });
  console.log(`✅ scan: packages=${scanned.packages.length} edges=${scanned.deps.length}`);
  console.log(`📦 wrote ${outDir}/repo.json`);

  const names = scanned.packages.map(p => p.name);
  const pkgJsonByName = new Map(scanned.packages.map(p => [p.name, p.relPackageJsonPath]));
  const warnings = [
    ...findSimilarPackageNames(names),
    ...findPrefixOutliers(names)
  ];
  if (warnings.length > 0) {
    // enrich warnings with file paths
    for (const w of warnings as any[]) {
      if (w.type === 'similar-package-names') {
        w.aPackageJsonPath = pkgJsonByName.get(w.a);
        w.bPackageJsonPath = pkgJsonByName.get(w.b);
      } else if (w.type === 'prefix-outlier') {
        w.packageJsonPath = pkgJsonByName.get(w.name);
      }
    }

    await writeJson(`${outDir}/repo.warnings.json`, warnings, { pretty: true });
    console.log(`⚠️  warnings: possible typos in package names (${warnings.length})`);
    for (const w of warnings.slice(0, 10)) {
      if (w.type === 'similar-package-names') {
        const ap = (w as any).aPackageJsonPath ? ` @ ${(w as any).aPackageJsonPath}` : '';
        const bp = (w as any).bPackageJsonPath ? ` @ ${(w as any).bPackageJsonPath}` : '';
        console.log(`   - ${w.a}${ap} ~ ${w.b}${bp} (distance=${w.distance})`);
      } else {
        const p = (w as any).packageJsonPath ? ` @ ${(w as any).packageJsonPath}` : '';
        console.log(`   - ${w.name}${p} (prefix '${w.actualPrefix}' ~ '${w.expectedPrefix}', distance=${w.distance})`);
      }
    }
    if (warnings.length > 10) console.log(`   - ... and ${warnings.length - 10} more`);
    console.log(`📦 wrote ${outDir}/repo.warnings.json`);
  }
}
