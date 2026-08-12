import { deleteStorageObject } from "./storage";

// 预渲染快照 key 生成，命名规则与 cli/src/tasks/seo-render.ts 的 saveFile 保持一致：
//   cache/<pathname>[&<query>]，末尾为 "/" 时追加 index.html
export function buildSnapshotKey(env: Env, url: URL): string {
  const folder = (env.S3_CACHE_FOLDER || "cache/").replace(/\/+$/, "");
  const searchPart = url.search ? url.search.replace("?", "&") : "";
  let key = `${folder}${url.pathname}${searchPart}`;
  key = key.replace(/\/{2,}/g, "/");
  if (key.endsWith("/")) {
    key += "index.html";
  }
  return key;
}

// 删除一组页面的预渲染快照（发文/更新/删除/置顶后调用），使页面回落实时直出，下次部署重爬补全
export async function clearPrerenderSnapshots(env: Env, paths: (string | null | undefined)[]): Promise<void> {
  if (!env.R2_BUCKET && !env.S3_ENDPOINT) {
    return;
  }

  for (const path of paths) {
    if (!path) continue;
    const url = new URL(path, "https://cunzhangblog.local");
    const key = buildSnapshotKey(env, url);
    try {
      await deleteStorageObject(env, key);
    } catch {
      // 清快照失败不影响发文流程
    }
  }
}
