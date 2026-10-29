import type { AdSlotKey, PublicAdSlot } from "@rin/api";
import { useEffect, useMemo, useState } from "react";
import { getCachedPublicAds, prefetchPublicAds, selectAdsForSlot } from "../utils/ads";
import { AdCard } from "./ad-card";

// 侧边栏 / 广告位容器：无可用广告时完全不占位
export function AdSlot({ slot, className }: { slot: AdSlotKey; className?: string }) {
  const [config, setConfig] = useState<PublicAdSlot | null>(() => getCachedPublicAds()?.[slot] ?? null);
  const [loaded, setLoaded] = useState(() => getCachedPublicAds() !== null);

  useEffect(() => {
    let alive = true;
    prefetchPublicAds().then((data) => {
      if (!alive) return;
      setConfig(data?.[slot] ?? null);
      setLoaded(true);
    });
    return () => {
      alive = false;
    };
  }, [slot]);

  // 随机结果在本次挂载内固定，避免重渲染时闪变
  const picked = useMemo(() => (loaded ? selectAdsForSlot(config, 1) : []), [loaded, config]);

  if (!loaded || picked.length === 0) return null;

  return (
    <div className={`w-full ${className ?? ""}`}>
      <AdCard ad={picked[0]} />
    </div>
  );
}
