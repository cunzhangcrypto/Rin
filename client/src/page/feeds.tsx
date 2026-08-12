import { useContext, useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link, useSearch } from "wouter"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"
import { ProfileContext } from "../state/profile"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"
import { tryInt } from "../utils/int"
import { useTranslation } from "react-i18next";

type FeedsData = {
    size: number,
    data: any[],
    hasNext: boolean
}

type FeedType = 'draft' | 'unlisted' | 'normal'

type FeedsMap = {
    [key in FeedType]: FeedsData
}

export function FeedsPage() {
    const { t } = useTranslation()
    const siteConfig = useSiteConfig();
    const query = new URLSearchParams(useSearch());
    const profile = useContext(ProfileContext);
    const [listState, _setListState] = useState<FeedType>(query.get("type") as FeedType || 'normal')
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [feeds, setFeeds] = useState<FeedsMap>({
        draft: { size: 0, data: [], hasNext: false },
        unlisted: { size: 0, data: [], hasNext: false },
        normal: { size: 0, data: [], hasNext: false }
    })
    const page = tryInt(1, query.get("page"))
    const limit = tryInt(siteConfig.pageSize, query.get("limit"))
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 ani-show md:columns-2" : "wauto flex flex-col ani-show";
    const ref = useRef("")
    function fetchFeeds(type: FeedType) {
        client.feed.list({
            page: page,
            limit: limit,
            type: type
        }).then(({ data }) => {
            if (data) {
                setFeeds({
                    ...feeds,
                    [type]: data
                })
                setStatus('idle')
            }
        })
    }
    useEffect(() => {
        const key = `${query.get("page")} ${query.get("type")} ${limit}`
        if (ref.current == key) return
        const type = query.get("type") as FeedType || 'normal'
        if (type !== listState) {
            _setListState(type)
        }
        setStatus('loading')
        fetchFeeds(type)
        ref.current = key
    }, [limit, query.get("page"), query.get("type")])
    return (
        <>
            <Helmet>
                <title>{`${t('article.title')} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={t('article.title')} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={feeds.draft.size + feeds.normal.size + feeds.unlisted.size > 0 || status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {listState === 'draft' ? t('draft_bin') : listState === 'normal' ? t('article.title') : t('unlisted')}
                        </p>
                        {listState === 'normal' && (
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('site_definition')}
                            </p>
                        )}
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: feeds[listState]?.size })}
                            </p>
                            {profile?.permission &&
                                <div className="flex flex-row space-x-4">
                                    <Link href={listState === 'draft' ? '/?type=normal' : '/?type=draft'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'draft' ? "text-theme" : ""}`}>
                                        {t('draft_bin')}
                                    </Link>
                                    <Link href={listState === 'unlisted' ? '/?type=normal' : '/?type=unlisted'} className={`text-sm mt-4 text-neutral-500 font-normal ${listState === 'unlisted' ? "text-theme" : ""}`}>
                                        {t('unlisted')}
                                    </Link>
                                </div>
                            }
                        </div>
                    </div>
                    <Waiting for={status === 'idle'}>
                        <div className={feedListClass}>
                            {feeds[listState].data.map(({ id, ...feed }: any) => (
                                <FeedCard key={id} id={id} {...feed} />
                            ))}
                        </div>
                        <Pagination
                            type={listState}
                            page={page}
                            totalPages={Math.max(1, Math.ceil((feeds[listState]?.size || 0) / Math.max(1, limit)))}
                            hasNext={feeds[listState]?.hasNext}
                        />
                    </Waiting>
                </main>
            </Waiting>
        </>
    )
}

// 生成分页页码：首页 + 当前页附近 ±2 + 尾页，中间用省略号
function buildPageItems(current: number, total: number): (number | string)[] {
    if (total <= 7) {
        return Array.from({ length: total }, (_, i) => i + 1)
    }
    const items: (number | string)[] = [1]
    const start = Math.max(2, current - 2)
    const end = Math.min(total - 1, current + 2)
    if (start > 2) items.push('...')
    for (let i = start; i <= end; i++) items.push(i)
    if (end < total - 1) items.push('...')
    items.push(total)
    return items
}

function Pagination({ type, page, totalPages, hasNext }: { type: FeedType; page: number; totalPages: number; hasNext: boolean }) {
    const { t } = useTranslation()
    if (totalPages <= 1) return null
    return (
        <div className="wauto flex flex-row items-center mt-4 ani-show">
            {page > 1 &&
                <Link href={`/?type=${type}&page=${(page - 1)}`}
                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                    {t('previous')}
                </Link>
            }
            <div className="flex-1" />
            <div className="flex flex-row items-center gap-1 flex-wrap justify-center">
                {page > 3 &&
                    <Link href={`/?type=${type}&page=1`}
                        className="text-sm font-normal rounded-full px-3 py-2 text-neutral-500 hover:text-theme">
                        {t('home')}
                    </Link>
                }
                {buildPageItems(page, totalPages).map((item, i) =>
                    item === '...' ? (
                        <span key={`ellipsis-${i}`} className="px-2 py-2 text-sm text-neutral-400">…</span>
                    ) : (
                        <Link key={item} href={`/?type=${type}&page=${item}`}
                            className={`text-sm font-normal rounded-full px-3.5 py-2 ${item === page ? "text-white bg-theme" : "text-neutral-500 hover:text-theme"}`}>
                            {item}
                        </Link>
                    )
                )}
                {page < totalPages &&
                    <Link href={`/?type=${type}&page=${totalPages}`}
                        className="text-sm font-normal rounded-full px-3 py-2 text-neutral-500 hover:text-theme">
                        {t('last_page')}
                    </Link>
                }
            </div>
            <div className="flex-1" />
            {hasNext &&
                <Link href={`/?type=${type}&page=${(page + 1)}`}
                    className={`text-sm font-normal rounded-full px-4 py-2 text-white bg-theme`}>
                    {t('next')}
                </Link>
            }
        </div>
    )
}
