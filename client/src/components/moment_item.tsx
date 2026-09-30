import { useState } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import { Markdown } from "./markdown";
import { timeago } from "../utils/timeago";

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

export function MomentItem({
    moment,
    onDelete,
    onEdit,
    canManage = false
}: {
    moment: Moment,
    onDelete?: (id: number) => void,
    onEdit?: (moment: Moment) => void,
    canManage?: boolean
}) {
    const { t } = useTranslation()
    const { createdAt, updatedAt } = moment;
    const [, navigate] = useLocation();
    const [copyTip, setCopyTip] = useState('');

    const url = `${window.location.origin}/moments/${moment.id}`;

    async function handleShare(e: React.MouseEvent) {
        e.stopPropagation();
        if (navigator.share) {
            try {
                await navigator.share({ title: moment.user.username, url });
                return;
            } catch {
                // 用户取消或失败时降级到复制
            }
        }
        try {
            await navigator.clipboard.writeText(url);
            setCopyTip(t('moments.copied'));
            setTimeout(() => setCopyTip(''), 2000);
        } catch {
            setCopyTip(t('moments.copied'));
            setTimeout(() => setCopyTip(''), 2000);
        }
    }

    function handleBodyClick(e: React.MouseEvent) {
        // 正文内已有真实链接时，交给链接自身处理，不做整卡跳转
        if ((e.target as HTMLElement).closest('a')) return;
        navigate(`/moments/${moment.id}`);
    }

    return (
        <div className="bg-w p-4 rounded-lg relative">
            <div className="flex justify-between">
                <div className="flex items-center space-x-3">
                    <img
                        src={moment.user.avatar}
                        alt={moment.user.username}
                        className="w-8 h-8 rounded-full object-cover"
                    />
                    <div>
                        <p className="t-primary">
                            {moment.user.username}
                        </p>
                        <p className="space-x-2 t-secondary text-sm">
                            <span title={new Date(createdAt).toLocaleString()}>
                                {createdAt === updatedAt ? timeago(createdAt) : t('feed_card.published$time', { time: timeago(createdAt) })}
                            </span>
                            {createdAt !== updatedAt &&
                                <span title={new Date(updatedAt).toLocaleString()}>
                                    {t('feed_card.updated$time', { time: timeago(updatedAt) })}
                                </span>
                            }
                        </p>
                    </div>
                </div>
                <div className="flex gap-2 items-center">
                    <button
                        aria-label={t("moments.copy_link")}
                        title={t("moments.copy_link")}
                        onClick={handleShare}
                        className="flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                    >
                        <i className="ri-share-line dark:text-neutral-400" />
                    </button>
                    {canManage && onEdit && onDelete && (
                        <>
                            <button
                                aria-label={t("edit")}
                                onClick={() => onEdit(moment)}
                                className="flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-edit-2-line dark:text-neutral-400" />
                            </button>
                            <button
                                aria-label={t("delete.title")}
                                onClick={() => onDelete(moment.id)}
                                className="flex flex-col items-end justify-center px-2 py bg-secondary bg-button rounded-full transition"
                            >
                                <i className="ri-delete-bin-7-line text-red-500" />
                            </button>
                        </>
                    )}
                </div>
            </div>
            <div className="text-black dark:text-white mt-2 cursor-pointer" onClick={handleBodyClick}>
                <Markdown content={moment.content} />
            </div>
            {copyTip && (
                <div className="absolute -top-10 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs font-bold py-1.5 px-4 rounded-full shadow-lg animate-bounce">
                    {copyTip}
                </div>
            )}
        </div>
    )
}