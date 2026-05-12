import { ensureDir, fileExists, writeJson } from '../utils/fs';

export function createCacheStore(opts: { dir: string }) {
  const dir = opts.dir;

  return {
    dir,
    async ensure() {
      await ensureDir(dir);
      await ensureDir(`${dir}/objects`);
    },
    async has(key: string) {
      return await fileExists(`${dir}/objects/${key}.json`);
    },
    async put(key: string, value: unknown) {
      await writeJson(`${dir}/objects/${key}.json`, value, { pretty: false });
    }
  };
}

