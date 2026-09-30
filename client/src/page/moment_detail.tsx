import { useEffect, useState } from "react"
import { Helmet } from 'react-helmet'
import { Link } from "wouter"
import { useTranslation } from "react-i18next"
import { client } from "../app/runtime"
import { Waiting } from "../components/loading"
import { MomentItem } from "../components/moment_item"
import { useSiteConfig } from "../hooks/useSiteConfig"

interface Moment {
    id: number;
    content: string;
    createdAt: Date;
    updatedAt: Date;
    user: {
        id: number;
        username: string;
        avatar: string;
    };
}

export function MomentDetailPage({ id }: { id: string }) {
    const [moment, setMoment] = useState<Moment | null>(null)
    const [loading, setLoading] = useState(true)
    const [notFound, setNotFound] = useState(false)
    const { t } = useTranslation()
    const siteConfig = useSiteConfig()

    useEffect(() => {
        const idNum = Number.parseInt(id, 10)
        if (!Number.isFinite(idNum) || idNum <= 0) {
            setNotFound(true)
            setLoading(false)
            return
        }
        setLoading(true)
        setNotFound(false)
        client.moments.get(idNum).then(({ data, error }) => {
            if (error || !data) {
                setNotFound(true)
            } else {
                setMoment(data as unknown as Moment)
            }
        }).finally(() => setLoading(false))
    }, [id])

    const momentTitle = `${t('moments.detail')} - ${siteConfig.name}`
    const description = moment?.content
        ? moment.content.replace(/[#>*`\[\]()!]/g, "").replace(/\s+/g, " ").slice(0, 120)
        : ""

    return (
        <>
            <Helmet>
                <title>{moment ? momentTitle : t('moments.title')}</title>
                <meta property="og:type" content="article" />
                <meta property="og:url" content={document.URL} />
                {description && <meta property="og:description" content={description} />}
            </Helmet>
            <Waiting for={!loading}>
                <main className="w-full flex flex-col justify-center items-center mb-8 ani-show">
                    <div className="wauto text-start text-black dark:text-white py-4 text-4xl font-bold">
                        <p>{t('moments.detail')}</p>
                    </div>
                    <div className="wauto">
                        {notFound ? (
                            <p className="text-neutral-500">{t('error.not_found')}</p>
                        ) : moment ? (
                            <div className="space-y-6">
                                <MomentItem moment={moment} onDelete={() => {}} onEdit={() => {}} canManage={false} />
                            </div>
                        ) : null}
                        <div className="py-6 text-center">
                            <Link href="/moments" className="text-sm font-normal rounded-full px-4 py-2 text-white bg-theme inline-block">
                                {t('moments.back_to_list')}
                            </Link>
                        </div>
                    </div>
                </main>
            </Waiting>
        </>
    )
}