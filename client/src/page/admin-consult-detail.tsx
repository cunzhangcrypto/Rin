import { useEffect, useState } from "react";
import { Helmet } from "react-helmet";
import { Link, useLocation } from "wouter";
import { client } from "../app/runtime";
import type { ConsultDetail, ConsultPaymentStatus, ConsultStatus } from "../api/client";
import { useAlert, useConfirm } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import {
  CONSULT_CATEGORY_LABELS,
  CONSULT_CONTACT_LABELS,
  CONSULT_NOTIFY_LABELS,
  CONSULT_PAYMENT_LABELS,
  CONSULT_STATUS_LABELS,
  consultNotifyClass,
  consultPackageText,
  consultStatusClass,
  formatConsultTime,
} from "../utils/consult";

const selectClass =
  "w-full rounded-xl border border-black/10 bg-w px-3 py-2 text-sm t-primary transition-colors focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10";

export function AdminConsultDetailPage({ id }: { id: string }) {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();
  const { showConfirm, ConfirmUI } = useConfirm();
  const [, setLocation] = useLocation();

  const [detail, setDetail] = useState<ConsultDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [retrying, setRetrying] = useState(false);
  const [status, setStatus] = useState<ConsultStatus>("pending");
  const [paymentStatus, setPaymentStatus] = useState<ConsultPaymentStatus>("unpaid");
  const [adminNote, setAdminNote] = useState("");

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await client.consult.adminGet(id);
      if (error) {
        showAlert(error.value);
        return;
      }
      if (data) {
        setDetail(data);
        setStatus(data.status);
        setPaymentStatus(data.paymentStatus);
        setAdminNote(data.adminNote || "");
        // 通知后台铃铛刷新未读数量
        window.dispatchEvent(new Event("consult:read"));
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "加载失败");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const { error } = await client.consult.adminUpdate(id, {
        status,
        paymentStatus,
        adminNote,
      });
      if (error) {
        showAlert(error.value);
        return;
      }
      showAlert("已保存");
      await load();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "保存失败");
    } finally {
      setSaving(false);
    }
  };

  const retryNotify = async () => {
    if (retrying) return;
    setRetrying(true);
    try {
      const { data, error } = await client.consult.adminRetryNotify(id);
      if (error) {
        showAlert(error.value);
        return;
      }
      showAlert(data?.success ? "Telegram 通知已重新发送" : "通知仍未成功，请检查 Bot 配置");
      await load();
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "重试失败");
    } finally {
      setRetrying(false);
    }
  };

  const remove = () => {
    showConfirm("删除咨询记录", "删除后不可恢复，确认删除这条咨询申请吗？", async () => {
      const { error } = await client.consult.adminDelete(id);
      if (error) {
        showAlert(error.value);
        return;
      }
      setLocation("/admin/consult");
    });
  };

  const copyContact = async () => {
    if (!detail?.contactAccount) return;
    try {
      await navigator.clipboard.writeText(detail.contactAccount);
      showAlert("联系方式已复制");
    } catch {
      showAlert("复制失败，请手动选择文本复制");
    }
  };

  if (loading) {
    return (
      <div className="py-16 text-center text-sm text-neutral-400">
        <Helmet>
          <title>{`咨询详情 - ${siteConfig.name}`}</title>
        </Helmet>
        加载中…
      </div>
    );
  }

  if (!detail) {
    return (
      <div className="py-16 text-center text-sm text-neutral-400">
        未找到该咨询记录，<Link href="/admin/consult" className="text-theme">返回列表</Link>
      </div>
    );
  }

  return (
    <>
      <Helmet>
        <title>{`${detail.requestNo} - ${siteConfig.name}`}</title>
      </Helmet>

      <div className="flex flex-col gap-5 t-primary">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/admin/consult" className="text-sm text-neutral-500 transition-colors hover:text-theme">
            ← 返回咨询管理
          </Link>
          <div className="flex items-center gap-2">
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${consultStatusClass(detail.status)}`}>
              {CONSULT_STATUS_LABELS[detail.status] || detail.status}
            </span>
            <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-medium ${consultNotifyClass(detail.notifyStatus)}`}>
              TG：{CONSULT_NOTIFY_LABELS[detail.notifyStatus] || detail.notifyStatus}
            </span>
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
          {/* 左侧：咨询内容 */}
          <div className="rounded-xl border border-black/5 bg-w p-5 dark:border-white/10">
            <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-black/5 pb-4 dark:border-white/5">
              <h2 className="font-mono text-lg font-semibold tracking-wide t-primary">{detail.requestNo}</h2>
              <span className="text-xs text-neutral-400">{formatConsultTime(detail.createdAt)}</span>
            </div>

            <dl className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="咨询类型" value={CONSULT_CATEGORY_LABELS[detail.category] || detail.category} />
              <Field label="咨询套餐" value={consultPackageText(detail.package, detail.packagePrice)} />
              <Field label="提交时间" value={formatConsultTime(detail.createdAt)} />
              <Field label="联系方式类型" value={CONSULT_CONTACT_LABELS[detail.contactType] || detail.contactType} />
            </dl>

            <div className="mt-4">
              <p className="text-xs font-medium text-neutral-400">联系方式账号</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2">
                <span className="break-all text-sm font-medium t-primary">{detail.contactAccount}</span>
                <button
                  type="button"
                  onClick={copyContact}
                  className="rounded-full border border-black/10 px-3 py-1 text-[11px] font-medium text-neutral-500 transition-colors hover:text-theme dark:border-white/10 dark:text-neutral-400"
                >
                  复制
                </button>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-400">遇到的问题</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-7 text-neutral-700 dark:text-neutral-200">
                {detail.problem}
              </p>
            </div>

            <div className="mt-5">
              <p className="text-xs font-medium text-neutral-400">期望效果</p>
              <p className="mt-1.5 whitespace-pre-wrap break-words text-sm leading-7 text-neutral-700 dark:text-neutral-200">
                {detail.expected}
              </p>
            </div>
          </div>

          {/* 右侧：处理操作 */}
          <div className="flex flex-col gap-4">
            <div className="rounded-xl border border-black/5 bg-w p-5 dark:border-white/10">
              <h3 className="text-sm font-semibold t-primary">处理操作</h3>

              <label className="mt-4 block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">处理状态</span>
                <select
                  value={status}
                  onChange={(event) => setStatus(event.target.value as ConsultStatus)}
                  className={selectClass}
                >
                  {Object.entries(CONSULT_STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">付款状态</span>
                <select
                  value={paymentStatus}
                  onChange={(event) => setPaymentStatus(event.target.value as ConsultPaymentStatus)}
                  className={selectClass}
                >
                  {Object.entries(CONSULT_PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="mt-3 block">
                <span className="mb-1.5 block text-xs font-medium text-neutral-500 dark:text-neutral-400">
                  管理员备注（仅后台可见）
                </span>
                <textarea
                  value={adminNote}
                  onChange={(event) => setAdminNote(event.target.value)}
                  rows={4}
                  maxLength={2000}
                  placeholder="记录沟通结果、报价或其他备注"
                  className="w-full resize-y rounded-xl border border-black/10 bg-w px-3 py-2 text-sm leading-6 t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500"
                />
              </label>

              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="mt-4 w-full rounded-full bg-theme px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-theme-hover disabled:cursor-not-allowed disabled:opacity-50"
              >
                {saving ? "保存中…" : "保存"}
              </button>
            </div>

            <div className="rounded-xl border border-black/5 bg-w p-5 dark:border-white/10">
              <h3 className="text-sm font-semibold t-primary">Telegram 通知</h3>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${consultNotifyClass(detail.notifyStatus)}`}>
                  {CONSULT_NOTIFY_LABELS[detail.notifyStatus] || detail.notifyStatus}
                </span>
                <span className="text-xs text-neutral-400">尝试 {detail.notifyAttempts} 次</span>
              </div>
              {detail.notifiedAt ? (
                <p className="mt-2 text-xs text-neutral-400">发送时间：{formatConsultTime(detail.notifiedAt)}</p>
              ) : null}
              {detail.notifyError ? (
                <p className="mt-2 break-words rounded-lg bg-rose-50 px-3 py-2 text-xs leading-5 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400">
                  {detail.notifyError}
                </p>
              ) : null}
              {detail.notifyStatus !== "sent" ? (
                <button
                  type="button"
                  onClick={retryNotify}
                  disabled={retrying}
                  className="mt-3 w-full rounded-full border border-black/10 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:text-theme disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:text-neutral-300"
                >
                  {retrying ? "发送中…" : "重新发送通知"}
                </button>
              ) : null}
            </div>

            <div className="rounded-xl border border-rose-200/70 bg-w p-5 dark:border-rose-900/50">
              <h3 className="text-sm font-semibold text-rose-600 dark:text-rose-400">删除咨询</h3>
              <p className="mt-1 text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                删除后不可恢复，请确认已处理完毕。
              </p>
              <button
                type="button"
                onClick={remove}
                className="mt-3 w-full rounded-full border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 transition-colors hover:bg-rose-50 dark:border-rose-900/60 dark:text-rose-400 dark:hover:bg-rose-500/10"
              >
                删除这条记录
              </button>
            </div>
          </div>
        </div>
      </div>

      <AlertUI />
      <ConfirmUI />
    </>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-medium text-neutral-400">{label}</dt>
      <dd className="mt-1 text-sm font-medium t-primary">{value}</dd>
    </div>
  );
}
