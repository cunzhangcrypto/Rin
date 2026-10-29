import type { PublicAd, PublicAdSlot, PublicAdsResponse } from "@rin/api";
import { client } from "../app/runtime";

// 全站共享一次广告请求：同一页面的左栏、右栏、正文复用同一份数据
let publicAdsPromise: Promise<PublicAdsResponse | null> | null = null;
let cachedPublicAds: PublicAdsResponse | null = null;

export function getCachedPublicAds(): PublicAdsResponse | null {
  return cachedPublicAds;
}

export function prefetchPublicAds(): Promise<PublicAdsResponse | null> {
  if (!publicAdsPromise) {
    publicAdsPromise = client.ads
      .publicList()
      .then(({ data, error }) => {
        if (error || !data) return null;
        cachedPublicAds = data;
        return data;
      })
      .catch(() => null);
  }
  return publicAdsPromise;
}

function weightedPick(pool: PublicAd[]): PublicAd {
  const total = pool.reduce((sum, ad) => sum + Math.max(1, ad.weight || 0), 0);
  let cursor = Math.random() * total;
  for (const ad of pool) {
    cursor -= Math.max(1, ad.weight || 0);
    if (cursor <= 0) return ad;
  }
  return pool[pool.length - 1];
}

// 按广告位模式挑选广告：固定展示 / 随机 / 加权随机；同一次调用内不重复
export function selectAdsForSlot(slot: PublicAdSlot | null | undefined, count = 1): PublicAd[] {
  if (!slot || !slot.enabled || slot.ads.length === 0 || count <= 0) return [];
  const limit = Math.min(count, slot.ads.length);
  if (slot.mode === "fixed") return slot.ads.slice(0, limit);

  const pool = [...slot.ads];
  const picked: PublicAd[] = [];
  while (picked.length < limit && pool.length > 0) {
    if (slot.mode === "weighted") {
      const ad = weightedPick(pool);
      picked.push(ad);
      pool.splice(pool.indexOf(ad), 1);
    } else {
      const index = Math.floor(Math.random() * pool.length);
      picked.push(pool.splice(index, 1)[0]);
    }
  }
  return picked;
}

const FENCE = /^\s*(```|~~~)/;
const BLOCK_START = /^\s*(#|>|\||!\[|```|~~~|- |\* |\+ |\d+\.\s)/;

/**
 * 把 Markdown 正文拆成 count+1 段，在安全位置插入广告：
 * - 只在空行边界切分，避开未闭合代码块
 * - 不切进标题、表格、图片说明、列表、引用
 * - 相邻广告之间至少间隔 minGap 个段落
 */
export function splitMarkdownForAds(content: string, count: number, minGap = 3): string[] {
  if (count <= 0 || content.length === 0) return [content];

  const lines = content.split("\n");
  const inFence: boolean[] = [];
  let fenceDepth = 0;
  for (const line of lines) {
    inFence.push(fenceDepth > 0);
    if (FENCE.test(line)) fenceDepth += 1;
  }

  const offsets: number[] = [];
  let offset = 0;
  for (const line of lines) {
    offsets.push(offset);
    offset += line.length + 1;
  }

  const candidates: { offset: number; paragraph: number }[] = [];
  let paragraph = 0;
  for (let i = 0; i < lines.length; i += 1) {
    if (i > 0 && lines[i - 1].trim() === "" && lines[i].trim() !== "") {
      paragraph += 1;
      if (!inFence[i] && !BLOCK_START.test(lines[i])) {
        candidates.push({ offset: offsets[i], paragraph });
      }
    }
  }
  if (candidates.length === 0) return [content];

  // 距文末至少保留一小段，避免广告出现在文章最末尾
  const minTail = Math.max(120, Math.floor(content.length / (count + 1) / 3));

  const cuts: number[] = [];
  let lastOffset = 0;
  let lastParagraph = 0;
  let cursor = 0;
  for (let k = 1; k <= count; k += 1) {
    const target = Math.floor((content.length * k) / (count + 1));
    let chosen: { offset: number; paragraph: number } | null = null;
    for (let i = cursor; i < candidates.length; i += 1) {
      const candidate = candidates[i];
      if (candidate.offset <= lastOffset) continue;
      if (candidate.offset < target) continue;
      if (candidate.paragraph - lastParagraph < minGap) continue;
      if (content.length - candidate.offset < minTail) break;
      chosen = candidate;
      cursor = i + 1;
      break;
    }
    if (!chosen) break;
    cuts.push(chosen.offset);
    lastOffset = chosen.offset;
    lastParagraph = chosen.paragraph;
  }

  if (cuts.length === 0) return [content];

  const parts: string[] = [];
  let start = 0;
  for (const cut of cuts) {
    parts.push(content.slice(start, cut));
    start = cut;
  }
  parts.push(content.slice(start));
  return parts;
}
