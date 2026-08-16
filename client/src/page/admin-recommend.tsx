import { SettingsCard, SettingsCardBody, SettingsCardHeader } from "@rin/ui";
import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { useTranslation } from "react-i18next";
import ReactLoading from "react-loading";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { Button } from "../components/button";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";

type RecItem = { id: number; title: string; alias?: string | null };

// 推荐阅读管理：调整显示顺序（最多 10 条）、关闭某些文章的推荐
export function AdminRecommendPage() {
  const { t } = useTranslation();
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [items, setItems] = useState<RecItem[]>([]);

  const load = () => {
    setLoading(true);
    client.feed.list({ type: "recommend", limit: 50 }).then(({ data, error }) => {
      if (error) {
        showAlert(error.value);
        return;
      }
      if (data) setItems(data.data as RecItem[]);
    }).catch((err) => showAlert(String(err))).finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const move = (index: number, dir: -1 | 1) => {
    setItems((prev) => {
      const next = [...prev];
      const j = index + dir;
      if (j < 0 || j >= next.length) return prev;
      [next[index], next[j]] = [next[j], next[index]];
      return next;
    });
  };

  const remove = async (id: number) => {
    setSaving(true);
    try {
      const { error } = await client.feed.update(id, { listed: true, recommended: false, recommend_order: 0 });
      if (error) {
        showAlert(error.value);
        return;
      }
      setItems((prev) => prev.filter((x) => x.id !== id));
      showAlert(t("recommend.saved"));
    } finally {
      setSaving(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      for (let i = 0; i < items.length; i++) {
        const { error } = await client.feed.update(items[i].id, {
          listed: true,
          recommended: true,
          recommend_order: i + 1,
        });
        if (error) {
          showAlert(error.value);
          return;
        }
      }
      showAlert(t("recommend.saved"));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <Helmet>
        <title>{`${t("recommend.manage")} - ${siteConfig.name}`}</title>
      </Helmet>
      <div className="mt-2 flex flex-col gap-4 t-primary sm:gap-6">
        <SettingsCard>
          <SettingsCardHeader
            title={t("recommend.manage")}
            description={t("recommend.tip")}
          />
          <SettingsCardBody>
            {loading ? (
              <div className="flex justify-center py-10"><ReactLoading type="spin" color="#4f46e5" height={28} width={28} /></div>
            ) : items.length === 0 ? (
              <p className="text-center py-10 text-neutral-400">{t("recommend.empty")}</p>
            ) : (
              <ul className="divide-y divide-black/5 dark:divide-white/5">
                {items.map((item, i) => (
                  <li key={item.id} className="flex items-center gap-3 py-2.5">
                    <span className="w-7 text-center text-sm font-bold text-neutral-400">{i + 1}</span>
                    <a
                      href={item.alias ? `/${item.alias}` : `/feed/${item.id}`}
                      target="_blank"
                      rel="noreferrer"
                      className="flex-1 min-w-0 truncate text-sm text-neutral-700 dark:text-neutral-300 hover:text-theme"
                    >
                      {item.title || `#${item.id}`}
                    </a>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        disabled={i === 0 || saving}
                        onClick={() => move(i, -1)}
                        className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("recommend.move_up")}
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        disabled={i === items.length - 1 || saving}
                        onClick={() => move(i, 1)}
                        className="w-7 h-7 rounded-lg border border-black/10 dark:border-white/10 text-neutral-500 hover:text-theme disabled:opacity-30 disabled:cursor-not-allowed"
                        aria-label={t("recommend.move_down")}
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => remove(item.id)}
                        className="ml-1 px-2 h-7 rounded-lg text-red-500 text-xs font-medium hover:bg-red-50 dark:hover:bg-red-500/10 disabled:opacity-30"
                      >
                        {t("recommend.remove")}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-5 flex items-center justify-between gap-3 border-t border-black/5 pt-4 dark:border-white/5">
              <Link href="/" className="text-sm text-neutral-500 hover:text-theme">
                ← {t("back_to_list")}
              </Link>
              <Button
                title={t("recommend.save_order")}
                onClick={save}
                disabled={saving || items.length === 0}
              />
            </div>
          </SettingsCardBody>
        </SettingsCard>
      </div>
      <AlertUI />
    </>
  );
}
