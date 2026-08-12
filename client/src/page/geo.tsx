import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants";
import type { GeoFeed } from "@rin/api";

// GEO 归档页：展示标记为「GEO 文章」（ai_visible=1）的内容，不进首页，仅供 AI 抓取器与访客查阅
export function GeoPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const [feeds, setFeeds] = useState<GeoFeed[]>([]);

  useEffect(() => {
    client.feed.geo().then(({ data }) => {
      if (data) setFeeds(data as GeoFeed[]);
    });
  }, []);

  return (
    <>
      <Helmet>
        <title>{`${t('geo.title')} - ${siteConfig.name}`}</title>
        <meta property="og:site_name" content={siteName} />
        <meta property="og:title" content={t('geo.title')} />
        <meta property="og:image" content={siteConfig.avatar} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={document.URL} />
      </Helmet>
      <main className="w-full flex flex-col justify-center items-center mb-8">
        <div className="wauto text-start text-black dark:text-white py-4">
          <p className="text-4xl font-bold">{t('geo.title')}</p>
          <p className="text-sm mt-4 text-neutral-500 font-normal leading-relaxed">
            {t('geo.description')}
          </p>
        </div>
        <div className="wauto flex flex-col ani-show">
          {feeds.length === 0 && (
            <p className="text-sm text-neutral-400 py-8">{t('geo.empty')}</p>
          )}
          {feeds.map((feed) => {
            const targetHref = feed.alias ? `/${feed.alias}` : `/feed/${feed.id}`;
            return (
              <Link
                key={feed.id}
                href={targetHref}
                className="block rounded-2xl bg-w m-2 px-6 py-4 transition-colors hover:bg-neutral-50 dark:hover:bg-white/5"
              >
                <p className="text-base font-bold t-primary break-all">{feed.title}</p>
                {feed.summary && (
                  <p className="text-sm text-neutral-500 mt-2 leading-relaxed line-clamp-3">
                    {feed.summary}
                  </p>
                )}
                <p className="text-xs text-neutral-400 mt-2">
                  {new Date(feed.createdAt).toLocaleDateString()}
                </p>
              </Link>
            );
          })}
        </div>
      </main>
    </>
  );
}
