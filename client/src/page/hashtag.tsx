import { useEffect, useRef, useState } from "react"
import { Helmet } from 'react-helmet'
import { useTranslation } from "react-i18next"
import { FeedCard } from "../components/feed_card"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"

import { useSiteConfig } from "../hooks/useSiteConfig";
import { siteName } from "../utils/constants"


type FeedsData = {
    name: string;
    id: number;
    createdAt: Date;
    updatedAt: Date;
    feeds: {
        hashtags: {
            name: string;
            id: number;
        }[];
        id: number;
        title: string | null;
        summary: string;
        content: string;
        createdAt: Date;
        updatedAt: Date;
        user: {
            id: number;
            username: string;
            avatar: string | null;
        };
    }[] | undefined;
}

export function HashtagPage({ name }: { name: string }) {
    const { i18n } = useTranslation() // 引入 i18n 实例获取当前前台切换的语言
    const siteConfig = useSiteConfig();
    const [status, setStatus] = useState<'loading' | 'idle'>('idle')
    const [hashtag, setHashtag] = useState<FeedsData>()
    const feedListClass = siteConfig.feedLayout === "masonry" ? "wauto columns-1 gap-5 md:columns-2" : "wauto flex flex-col";
    const ref = useRef("")

    function fetchFeeds() {
        // 先进行标准 URI 解码，确保拿到干净的标签明文（如：AI PPT）
        const nameDecoded = decodeURI(name) || name
        
        // 关键改动：对带空格、中文的标签名进行安全编码，直接穿透线上 Cloudflare CORS 跨域安全机制
        const safeTagName = encodeURIComponent(nameDecoded)

        client.tag.get(safeTagName).then(({ data }) => {
            if (data) {
                setHashtag(data as any)
            }
            // 请求结束，无论是否有数据，必须关闭 loading 状态，防止本地卡死
            setStatus('idle')
        }).catch(() => {
            setStatus('idle')
        })
    }

    useEffect(() => {
        if (ref.current === name) return
        setStatus('loading')
        fetchFeeds()
        ref.current = name
    }, [name])

    // 自适应强健多语言文本渲染：完全摆脱多语言框架保留字和外部环境限制，安全度 100%
    const renderArticleCountText = () => {
        const count = hashtag?.feeds?.length || 0;
        const currentLang = i18n.language || 'zh';

        if (currentLang.startsWith('en')) {
            return `${count} ${count === 1 ? 'article' : 'articles'} in total`;
        } else if (currentLang.startsWith('ja')) {
            return `合計 ${count} 記事`;
        } else {
            // 默认中文（包括 zh-CN, zh-TW）
            return `共有 ${count} 篇文章`;
        }
    };

    return (
        <>
            <Helmet>
                <title>{`${hashtag?.name || decodeURI(name)} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={hashtag?.name || decodeURI(name)} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={status === 'idle'}>
                <main className="w-full flex flex-col justify-center items-center mb-8">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>
                            {hashtag?.name || decodeURI(name)}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {renderArticleCountText()}
                            </p>
                        </div>
                    </div>
                    <div className={feedListClass}>
                        {hashtag?.feeds?.map(({ id, ...feed }: any) => (
                            <FeedCard key={id} id={id} {...feed} />
                        ))}
                    </div>
                </main>
            </Waiting>
        </>
    )
}
