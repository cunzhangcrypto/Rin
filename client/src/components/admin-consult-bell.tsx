import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "wouter";
import { client } from "../app/runtime";
import type { ConsultListItem } from "../api/client";
import {
  CONSULT_CATEGORY_LABELS,
  CONSULT_PACKAGE_LABELS,
  formatConsultTime,
} from "../utils/consult";

const POLL_INTERVAL = 30_000;

export function AdminConsultBell() {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState<ConsultListItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const refresh = useCallback(async () => {
    const { data } = await client.consult.adminUnread();
    if (data) {
      setUnread(data.unread || 0);
      setItems(data.items || []);
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, POLL_INTERVAL);
    const handleRead = () => refresh();
    window.addEventListener("consult:read", handleRead);
    window.addEventListener("focus", handleRead);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener("consult:read", handleRead);
      window.removeEventListener("focus", handleRead);
    };
  }, [refresh]);

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((value) => !value);
          if (!open) refresh();
        }}
        aria-label="咨询通知"
        className="relative flex h-10 w-10 items-center justify-center rounded-full border border-black/10 bg-w text-neutral-600 transition-colors hover:text-theme dark:border-white/10 dark:text-neutral-300"
      >
        <i className="ri-notification-3-line text-lg" />
        {unread > 0 ? (
          <span className="absolute -right-1 -top-1 flex min-w-5 items-center justify-center rounded-full bg-theme px-1.5 text-[10px] font-semibold leading-5 text-white">
            {unread > 99 ? "99+" : unread}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 z-50 mt-2 w-80 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-black/10 bg-w shadow-xl dark:border-white/10">
          <div className="flex items-center justify-between border-b border-black/5 px-4 py-3 dark:border-white/5">
            <span className="text-sm font-semibold t-primary">咨询通知</span>
            <span className="text-xs text-neutral-400">{unread > 0 ? `${unread} 条未读` : "暂无未读"}</span>
          </div>

          <div className="max-h-80 overflow-y-auto">
            {!loaded ? (
              <p className="px-4 py-8 text-center text-xs text-neutral-400">加载中…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-xs text-neutral-400">还没有咨询申请</p>
            ) : (
              items.map((item) => (
                <Link
                  key={item.id}
                  href={`/admin/consult/${item.id}`}
                  onClick={() => setOpen(false)}
                  className={`flex items-start gap-3 border-b border-black/5 px-4 py-3 transition-colors last:border-0 hover:bg-neutral-50 dark:border-white/5 dark:hover:bg-white/5 ${
                    item.isRead ? "" : "bg-theme/5"
                  }`}
                >
                  <span
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.isRead ? "bg-neutral-300 dark:bg-neutral-600" : "bg-theme"}`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs font-mono font-semibold t-primary">{item.requestNo}</span>
                      <span className="shrink-0 text-[11px] text-neutral-400">{formatConsultTime(item.createdAt)}</span>
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-neutral-500 dark:text-neutral-400">
                      {CONSULT_CATEGORY_LABELS[item.category] || item.category} ·{" "}
                      {CONSULT_PACKAGE_LABELS[item.package] || item.package}
                    </span>
                  </span>
                </Link>
              ))
            )}
          </div>

          <Link
            href="/admin/consult"
            onClick={() => setOpen(false)}
            className="block border-t border-black/5 px-4 py-3 text-center text-xs font-medium text-theme transition-colors hover:bg-theme/5 dark:border-white/5"
          >
            查看全部咨询 →
          </Link>
        </div>
      ) : null}
    </div>
  );
}
