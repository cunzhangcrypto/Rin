import type { PublicAdSlot } from "@rin/api";
import { Fragment, useEffect, useMemo, useState } from "react";
import { getCachedPublicAds, prefetchPublicAds, selectAdsForSlot, splitMarkdownForAds } from "../utils/ads";
import { AdCard } from "./ad-card";
import { Markdown } from "./markdown";

// 文章正文：按后台配置在安全段落位置插入多条广告
export function ArticleContent({ content }: { content: string }) {
  const initial = getCachedPublicAds();
  const [inline, setInline] = useState<PublicAdSlot | null>(initial?.inline ?? null);
  const [loaded, setLoaded] = useState(initial !== null);

  useEffect(() => {
    let alive = true;
    prefetchPublicAds().then((data) => {
      if (!alive) return;
      setInline(data?.inline ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  const picked = useMemo(() => selectAdsForSlot(inline, inline?.maxCount ?? 1), [inline]);
  const parts = useMemo(
    () => splitMarkdownForAds(content, picked.length, inline?.minGap ?? 3),
    [content, picked, inline],
  );

  if (!loaded || picked.length === 0 || parts.length <= 1) {
    return <Markdown content={content} />;
  }

  return (
    <>
      {parts.map((part, index) => (
        <Fragment key={index}>
          <Markdown content={part} />
          {index < parts.length - 1 && picked[index] && (
            <div className="my-6 w-full max-w-full overflow-hidden">
              <AdCard ad={picked[index]} />
            </div>
          )}
        </Fragment>
      ))}
    </>
  );
}
