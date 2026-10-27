import { useEffect, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link } from "wouter"
import { FEED_CATEGORIES, type CategoryFeedItem } from "@rin/api"
import { Waiting } from "../components/loading"
import { client } from "../app/runtime"
import { useSiteConfig } from "../hooks/useSiteConfig"
import { siteName } from "../utils/constants"
import { useTranslation } from "react-i18next"

function groupByYear(items: CategoryFeedItem[]) {
    return items.reduce<Record<number, CategoryFeedItem[]>>((acc, item) => {
        const year = new Date(item.createdAt).getFullYear()
        ;(acc[year] ||= []).push(item)
        return acc
    }, {})
}

export function CategoryPage({ name }: { name: string }) {
    const [items, setItems] = useState<CategoryFeedItem[] | null>(null)
    const { t } = useTranslation()
    const siteConfig = useSiteConfig()
    const category = FEED_CATEGORIES.find((item) => item.key === name)

    useEffect(() => {
        setItems(null)
        client.feed.category(name)
            .then(({ data }) => setItems(Array.isArray(data) ? data : []))
            .catch((err) => {
                console.error("fetchCategory error:", err)
                setItems([])
            })
    }, [name])

    const groups = items ? groupByYear(items) : {}
    const years = Object.keys(groups).sort((a, b) => parseInt(b) - parseInt(a))

    return (
        <>
            <Helmet>
                <title>{`${category?.name || name} - ${siteConfig.name}`}</title>
                <meta property="og:site_name" content={siteName} />
                <meta property="og:title" content={category?.name || name} />
                <meta property="og:image" content={siteConfig.avatar} />
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
            </Helmet>
            <Waiting for={items !== null}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p className="flex items-center gap-3">
                            {category?.icon && <i className={category.icon} aria-hidden="true" style={{ color: category.color }} />}
                            {category?.name || name}
                        </p>
                        <div className="flex flex-row justify-between">
                            <p className="text-sm mt-4 text-neutral-500 font-normal">
                                {t('article.total$count', { count: items?.length || 0 })}
                            </p>
                        </div>
                    </div>
                    {items && items.length === 0 && (
                        <div className="wauto py-16 text-center text-sm t-secondary">
                            {t('category_empty')}
                        </div>
                    )}
                    {years.map(year => (
                        <div key={year} className="wauto flex flex-col justify-center items-start">
                            <h1 className="flex flex-row items-center space-x-2">
                                <span className="text-2xl font-bold t-primary">
                                    {t('year$year', { year: year })}
                                </span>
                                <span className="text-sm t-secondary">
                                    {t('article.total_short$count', { count: groups[+year]?.length })}
                                </span>
                            </h1>
                            <div className="w-full flex flex-col justify-center items-start my-4">
                                {groups[+year]?.map(({ id, title, alias, createdAt, pv }) => (
                                    <CategoryItem
                                        key={id}
                                        id={id.toString()}
                                        alias={alias}
                                        title={title || t('unlisted')}
                                        createdAt={new Date(createdAt)}
                                        pv={pv}
                                    />
                                ))}
                            </div>
                        </div>
                    ))}
                </main>
            </Waiting>
        </>
    )
}

function CategoryItem({ id, title, alias, createdAt, pv }: { id: string, title: string, alias?: string | null, createdAt: Date, pv: number }) {
    const { t } = useTranslation()
    const formatter = new Intl.DateTimeFormat('en-US', { day: '2-digit', month: '2-digit' })
    const href = alias ? `/${alias}` : `/feed/${id}`
    return (
        <div className="flex flex-row pl-8 w-full">
            <div className="flex flex-row items-center">
                <div className="w-2 h-2 bg-theme rounded-full"></div>
            </div>
            <div className="flex-1 rounded-2xl m-2 duration-300 flex flex-row items-center gap-4">
                <span className="t-secondary text-sm shrink-0" title={new Date(createdAt).toLocaleString()}>
                    {formatter.format(new Date(createdAt))}
                </span>
                <Link href={href} target="_blank" className="text-base t-primary hover:text-theme text-pretty overflow-hidden">
                    {title}
                </Link>
                <span className="text-xs t-secondary whitespace-nowrap shrink-0">
                    {pv.toLocaleString()} {t('category_views')}
                </span>
            </div>
        </div>
    )
}
