export type AdItem = {
  image: string;
  title: string;
  desc: string;
  url: string;
};

export async function fetchAds(): Promise<AdItem[]> {
  try {
    const res = await fetch("/ads.json");
    if (!res.ok) return [];
    const json = await res.json();
    if (!Array.isArray(json)) return [];
    return (json as AdItem[]).filter((a) => a && a.title && a.url);
  } catch {
    return [];
  }
}

export function pickRandomAds(list: AdItem[], count: number): AdItem[] {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}

// 把 markdown 正文拆除成两段，切点尽量落在文章长度约一半处的空行，
// 且避免切进代码块（``` ~~~）内部。
export function splitMarkdownInMiddle(content: string): [string, string] {
  const lines = content.split("\n");
  const target = Math.floor(content.length / 2);

  // 预计算每一行是否位于未闭合的代码围栏内
  let fence = 0;
  const fenceState: boolean[] = [];
  for (const line of lines) {
    fenceState.push(fence % 2 === 1);
    if (/^\s*(```|~~~)/.test(line)) fence += 1;
  }

  // 在空行边界寻找距中点最近的切点（i 行开头，i-1 行为空行且未在代码块内）
  let offset = 0;
  let bestOffset = -1;
  let bestDist = Infinity;
  for (let i = 0; i < lines.length; i++) {
    if (i > 0 && !fenceState[i] && lines[i - 1].trim() === "") {
      const dist = Math.abs(offset - target);
      if (dist < bestDist) {
        bestDist = dist;
        bestOffset = offset;
      }
    }
    offset += lines[i].length + 1;
  }

  const cut = bestOffset >= 0 ? bestOffset : target;
  return [content.slice(0, cut), content.slice(cut)];
}