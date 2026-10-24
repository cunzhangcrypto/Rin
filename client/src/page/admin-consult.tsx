import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import type { ConsultListResponse } from "../api/client";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  CONSULT_CATEGORY_LABELS,
  CONSULT_CONTACT_LABELS,
  CONSULT_PACKAGE_LABELS,
  CONSULT_STATUS_LABELS,
  consultPackageText,
  consultStatusClass,
  formatConsultTime,
} from "../utils/consult";

const PAGE_LIMIT = 20;

const inputClass =
  "w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500";

export function AdminConsultPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  const [data, setData] = useState<ConsultListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);

  const [q, setQ] = useState("");
  const [category, setCategory] = useState("");
  const [pkg, setPkg] = useState("");
  const [status, setStatus] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const load = async (targetPage: number) => {
    setLoading(true);
    try {
      const { data: response, error } = await client.consult.adminList({
        page: targetPage,
        limit: PAGE_LIMIT,
        q: q.trim() || undefined,
        category: category || undefined,
        package: pkg || undefined,
        status: status || undefined,
        dateFrom: dateFrom || undefined,
        dateTo: dateTo || undefined,
      });
      if (error) {
        showAlert(error.value);
        return;
      }
      if (response) setData(response);
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const applyFilters = () => {
    setPage(1);
    load(1);
  };

  const resetFilters = () => {
    setQ("");
    setCategory("");
    setPkg("");
    setStatus("");
    setDateFrom("");
    setDateTo("");
    setPage(1);
    setLoading(true);
    client.consult
      .adminList({ page: 1, limit: PAGE_LIMIT })
      .then(({ data: response, error }) => {
        if (error) showAlert(error.value);
        else if (response) setData(response);
      })
      .catch((err) => showAlert(err instanceof Error ? err.message : "加载失败"))
      .finally(() => setLoading(false));
  };

  const gotoPage = (targetPage: number) => {
    setPage(targetPage);
    load(targetPage);
  };

  const totalPages = Math.max(1, Math.ceil((data?.total || 0) / PAGE_LIMIT));

  return (
    <>
      <Helmet>
        <title>{`咨询管理 - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-col gap-5 t-primary">
        {/* 筛选区 */}
        <div className="rounded-xl border border-black/5 bg-w p-4 dark:border-white/10">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">申请编号</span>
              <input
                value={q}
                onChange={(event) => setQ(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") applyFilters();
                }}
                placeholder="搜索申请编号"
                className={inputClass}
              />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">咨询类型</span>
              <select value={category} onChange={(event) => setCategory(event.target.value)} className={inputClass}>
                <option value="">全部类型</option>
                {Object.entries(CONSULT_CATEGORY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">咨询套餐</span>
              <select value={pkg} onChange={(event) => setPkg(event.target.value)} className={inputClass}>
                <option value="">全部套餐</option>
                {Object.entries(CONSULT_PACKAGE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">处理状态</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}>
                <option value="">全部状态</option>
                {Object.entries(CONSULT_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">开始日期</span>
              <input type="date" value={dateFrom} onChange={(event) => setDateFrom(event.target.value)} className={inputClass} />
            </label>
            <label className="block">
              <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">结束日期</span>
              <input type="date" value={dateTo} onChange={(event) => setDateTo(event.target.value)} className={inputClass} />
            </label>
            <div className="flex items-end gap-2 sm:col-span-2">
              <button
                type="button"
                onClick={applyFilters}
                className="rounded-full bg-theme px-5 py-2 text-sm font-medium text-white transition-colors hover:bg-theme-hover"
              >
                查询
              </button>
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-full border border-black/10 px-5 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-theme dark:border-white/10 dark:text-neutral-300"
              >
                重置
              </button>
            </div>
          </div>
        </div>

        {/* 列表 */}
        <div className="overflow-hidden rounded-xl border border-black/5 bg-w dark:border-white/10">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[920px] text-sm">
              <thead>
                <tr className="border-b border-black/5 bg-neutral-50 text-left text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:border-white/5 dark:bg-white/5 dark:text-neutral-400">
                  <th className="px-4 py-3">申请编号</th>
                  <th className="px-4 py-3">咨询类型</th>
                  <th className="px-4 py-3">咨询套餐</th>
                  <th className="px-4 py-3">联系方式</th>
                  <th className="px-4 py-3">提交时间</th>
                  <th className="px-4 py-3">阅读状态</th>
                  <th className="px-4 py-3">处理状态</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-black/5 dark:divide-white/5">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-400">
                      加载中…
                    </td>
                  </tr>
                ) : (data?.data.length || 0) === 0 ? (
                  <tr>
                    <td colSpan={8} className="px-4 py-12 text-center text-sm text-neutral-400">
                      暂无咨询申请
                    </td>
                  </tr>
                ) : (
                  data?.data.map((item) => (
                    <tr
                      key={item.id}
                      className={`transition-colors hover:bg-neutral-50 dark:hover:bg-white/5 ${
                        item.isRead ? "" : "bg-theme/5"
                      }`}
                    >
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className="flex items-center gap-2">
                          {!item.isRead ? <span className="h-2 w-2 rounded-full bg-theme" /> : null}
                          <span className={`font-mono text-xs ${item.isRead ? "" : "font-semibold"} t-primary`}>
                            {item.requestNo}
                          </span>
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        {CONSULT_CATEGORY_LABELS[item.category] || item.category}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        {consultPackageText(item.package, item.packagePrice)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-neutral-600 dark:text-neutral-300">
                        {CONSULT_CONTACT_LABELS[item.contactType] || item.contactType}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-xs text-neutral-500 dark:text-neutral-400">
                        {formatConsultTime(item.createdAt)}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                            item.isRead
                              ? "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400"
                              : "bg-theme/10 text-theme"
                          }`}
                        >
                          {item.isRead ? "已读" : "未读"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${consultStatusClass(item.status)}`}>
                          {CONSULT_STATUS_LABELS[item.status] || item.status}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 text-right">
                        <Link
                          href={`/admin/consult/${item.id}`}
                          className="text-xs font-medium text-theme transition-colors hover:opacity-80"
                        >
                          查看详情
                        </Link>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* 分页 */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-black/5 px-4 py-3 dark:border-white/5">
            <span className="text-xs text-neutral-500 dark:text-neutral-400">
              共 {data?.total || 0} 条 · 第 {page} / {totalPages} 页
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => gotoPage(page - 1)}
                className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
              >
                上一页
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => gotoPage(page + 1)}
                className="rounded-full border border-black/10 px-4 py-1.5 text-xs font-medium text-neutral-600 disabled:cursor-not-allowed disabled:opacity-40 dark:border-white/10 dark:text-neutral-300"
              >
                下一页
              </button>
            </div>
          </div>
        </div>
      </div>

      <AlertUI />
    </>
  );
}
