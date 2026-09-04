import { useEffect, useState } from "react";
import { fetchAds, pickRandomAds, type AdItem } from "../utils/ads";

// 文章正文中段原生广告：来源 /ads.json，每次加载随机抽 1 条
export function InlineAd() {
  const [ad, setAd] = useState<AdItem | null>(null);

  useEffect(() => {
    fetchAds().then((list) => {
      if (list.length === 0) return;
      const picked = pickRandomAds(list, 1)[0];
      setAd(picked ?? null);
    });
  }, []);

  if (!ad) return null;

  return (
    <div className="my-6">
      <div className="text-xs font-medium text-gray-400 tracking-widest flex items-center gap-2 mb-2">
        <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800"></span>
        广告
        <span className="flex-1 h-px bg-gray-100 dark:bg-gray-800"></span>
      </div>
      <a
        href={ad.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex flex-col md:flex-row overflow-hidden rounded-2xl border border-gray-100 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-sm group transition-colors hover:border-teal-600"
      >
        <div className="w-full md:w-[34%] shrink-0 overflow-hidden">
          <img
            src={ad.image}
            alt={ad.title}
            loading="lazy"
            className="w-full aspect-[64/30] md:aspect-auto md:h-24 object-cover rounded-b-xl md:rounded-r-xl group-hover:scale-105 transition-transform duration-300"
          />
        </div>
        <div className="flex-1 min-w-0 pl-4 pr-4 py-3 md:pl-6 md:pr-4 flex flex-col justify-center gap-1">
          <div className="flex items-center gap-4">
            <span className="flex-1 min-w-0 text-[22px] font-medium text-teal-700 dark:text-teal-300 line-clamp-2">{ad.title}</span>
            <span className="shrink-0 ml-auto text-xs font-medium text-gray-400">了解更多 →</span>
          </div>
          {ad.desc && <p className="text-[14px] text-gray-400 line-clamp-1">{ad.desc}</p>}
        </div>
      </a>
    </div>
  );
}