import { useState } from "react";
import { Helmet } from "react-helmet";
import { Link } from "wouter";
import { client } from "../app/runtime";
import { ButtonWithLoading } from "../components/button";
import { useAlert } from "../components/dialog";
import { useSiteConfig } from "../hooks/useSiteConfig";
import type { ConsultCategory, ConsultContactType, ConsultPackage } from "../api/client";

const CATEGORIES: Array<{ value: ConsultCategory; title: string; desc: string; icon: string }> = [
  { value: "vps", title: "VPS / 网络配置", desc: "服务器选购、基础配置、线路建议、故障排查。", icon: "ri-server-line" },
  { value: "ai", title: "AI 工具使用", desc: "模型选择、API 接入、客户端设置、工具使用。", icon: "ri-robot-2-line" },
  { value: "web", title: "网站 / Cloudflare", desc: "域名解析、DNS、SSL、Cloudflare 设置、网站上线。", icon: "ri-global-line" },
  { value: "other", title: "其他技术问题", desc: "开源工具安装、软件环境配置、教程操作问题。", icon: "ri-tools-line" },
];

const PACKAGES: Array<{
  value: ConsultPackage;
  name: string;
  price: number;
  duration?: string;
  channel: string;
  desc: string;
}> = [
  {
    value: "text",
    name: "文字咨询",
    price: 29,
    channel: "微信 | QQ | TG | Email",
    desc: "通过文字沟通，提供技术问题分析、配置建议、操作指导及常见故障排查。",
  },
  {
    value: "remote",
    name: "一对一远程指导",
    price: 99,
    duration: "30 分钟",
    channel: "语音 / 屏幕共享",
    desc: "适合实时配置指导、操作演示和故障排查。",
  },
  {
    value: "full",
    name: "完整配置指导",
    price: 199,
    duration: "60 分钟",
    channel: "语音 / 屏幕共享",
    desc: "适合 VPS 环境搭建、Cloudflare 配置、开源工具安装等目标明确的任务。",
  },
];

const CONTACT_TYPES: Array<{ value: ConsultContactType; label: string; placeholder: string }> = [
  { value: "wechat", label: "微信", placeholder: "请填写微信号" },
  { value: "qq", label: "QQ", placeholder: "请填写 QQ 号" },
  { value: "telegram", label: "Telegram", placeholder: "请填写 TG 用户名" },
  { value: "email", label: "Email", placeholder: "请填写邮箱地址" },
];

const MAX_PROBLEM = 2000;
const MAX_EXPECTED = 1500;

export function ConsultPage() {
  const siteConfig = useSiteConfig();
  const { showAlert, AlertUI } = useAlert();

  const [category, setCategory] = useState<ConsultCategory | "">("");
  const [pkg, setPkg] = useState<ConsultPackage | "">("");
  const [problem, setProblem] = useState("");
  const [expected, setExpected] = useState("");
  const [contactType, setContactType] = useState<ConsultContactType>("wechat");
  const [contactAccount, setContactAccount] = useState("");
  const [website, setWebsite] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ requestNo: string } | null>(null);

  const selectedContact = CONTACT_TYPES.find((item) => item.value === contactType) || CONTACT_TYPES[0];

  const validate = (): string | null => {
    if (!category) return "请选择咨询类型";
    if (!pkg) return "请选择咨询套餐";
    if (problem.trim().length < 5) return "请把遇到的问题描述得更具体一些（至少 5 个字）";
    if (problem.length > MAX_PROBLEM) return `问题描述不能超过 ${MAX_PROBLEM} 个字符`;
    if (expected.trim().length < 3) return "请填写期望达到的效果";
    if (expected.length > MAX_EXPECTED) return `期望效果不能超过 ${MAX_EXPECTED} 个字符`;
    const account = contactAccount.trim();
    if (account.length < 2) return `请填写${selectedContact.label}账号`;
    if (contactType === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(account)) {
      return "邮箱格式不正确";
    }
    return null;
  };

  const submit = async () => {
    if (submitting) return;
    const error = validate();
    if (error) {
      showAlert(error);
      return;
    }

    setSubmitting(true);
    try {
      const { data, error: requestError } = await client.consult.create({
        category: category as ConsultCategory,
        package: pkg as ConsultPackage,
        problem: problem.trim(),
        expected: expected.trim(),
        contactType,
        contactAccount: contactAccount.trim(),
        website,
      });
      if (requestError) {
        showAlert(requestError.value);
        return;
      }
      if (data?.requestNo) {
        setResult({ requestNo: data.requestNo });
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    } catch (err) {
      showAlert(err instanceof Error ? err.message : "提交失败，请稍后再试");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="w-full flex flex-row justify-center ani-show">
      <div className="xl:w-64" />
      <main className="wauto pb-16">
        <div className="m-2">
      <Helmet>
        <title>{`付费咨询 - ${siteConfig.name}`}</title>
        <meta
          name="description"
          content="技术问题搞不定？找村长帮你！VPS / 网络配置、AI 工具使用、网站 / Cloudflare 等问题的一对一付费咨询。"
        />
      </Helmet>

      {result ? (
        <div className="mt-10 rounded-3xl border border-black/5 bg-w px-6 py-14 text-center shadow-sm dark:border-white/10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-50 text-emerald-500 dark:bg-emerald-500/10">
            <i className="ri-check-line text-3xl" />
          </div>
          <h1 className="mt-6 text-2xl font-semibold tracking-tight t-primary">咨询申请提交成功！</h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-neutral-500 dark:text-neutral-400">
            村长会先查看你的问题，确认能够提供帮助后，通过你留下的联系方式与你联系。请勿提前付款。
          </p>
          <div className="mx-auto mt-7 inline-flex items-center gap-2 rounded-full bg-neutral-100 px-5 py-2.5 text-sm dark:bg-white/5">
            <span className="text-neutral-500 dark:text-neutral-400">申请编号</span>
            <span className="font-mono font-semibold tracking-wide t-primary">{result.requestNo}</span>
          </div>
          <div className="mt-9 flex justify-center">
            <Link
              href="/"
              className="rounded-full bg-theme px-6 py-2.5 text-sm font-medium text-white transition-colors hover:bg-theme-hover"
            >
              返回首页
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* 主视觉 */}
          <section className="pt-6 sm:pt-10">
            <p className="text-sm font-semibold tracking-[0.2em] text-theme/70">村长帮帮忙</p>
            <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-[-0.03em] t-primary sm:text-4xl">
              技术问题搞不定？找村长帮你！
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-neutral-500 dark:text-neutral-400 sm:text-base">
              跟着教程操作还是不会？AI 工具不会配置？服务器搭建遇到问题？把你的问题告诉我，一起找到解决办法。
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {["从 ¥29 起", "先确认需求", "一对一指导"].map((tag) => (
                <span
                  key={tag}
                  className="rounded-full border border-black/5 bg-w px-3 py-1.5 text-xs font-medium text-neutral-600 dark:border-white/10 dark:text-neutral-300"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          {/* 服务分类 */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
              我能帮你解决
            </h2>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {CATEGORIES.map((item) => {
                const active = category === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setCategory(item.value)}
                    className={`group flex items-start gap-4 rounded-2xl border p-4 text-left transition-all ${
                      active
                        ? "border-theme/40 bg-theme/5"
                        : "border-black/5 bg-w hover:border-theme/30 dark:border-white/10"
                    }`}
                  >
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
                        active ? "bg-theme text-white" : "bg-neutral-100 text-neutral-500 dark:bg-white/5 dark:text-neutral-300"
                      }`}
                    >
                      <i className={`${item.icon} text-lg`} />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold t-primary">{item.title}</span>
                      <span className="mt-1 block text-xs leading-5 text-neutral-500 dark:text-neutral-400">
                        {item.desc}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 咨询套餐 */}
          <section className="mt-10">
            <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-400 dark:text-neutral-500">
              咨询套餐
            </h2>
            <div className="mt-4 grid gap-3 md:grid-cols-3">
              {PACKAGES.map((item) => {
                const active = pkg === item.value;
                return (
                  <button
                    key={item.value}
                    type="button"
                    onClick={() => setPkg(item.value)}
                    className={`relative flex flex-col rounded-2xl border p-5 text-left transition-all ${
                      active
                        ? "border-theme bg-theme/5 shadow-sm"
                        : "border-black/5 bg-w hover:border-theme/30 dark:border-white/10"
                    }`}
                  >
                    {active ? (
                      <span className="absolute right-4 top-4 flex h-5 w-5 items-center justify-center rounded-full bg-theme text-white">
                        <i className="ri-check-line text-xs" />
                      </span>
                    ) : null}
                    <span className="text-sm font-semibold t-primary">{item.name}</span>
                    <span className="mt-3 flex items-baseline gap-1">
                      <span className="text-xs text-neutral-400">¥</span>
                      <span className="text-3xl font-bold tracking-tight t-primary">{item.price}</span>
                    </span>
                    <span className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                      {item.duration ? `${item.duration} · ` : ""}
                      {item.channel}
                    </span>
                    <span className="mt-3 text-xs leading-5 text-neutral-500 dark:text-neutral-400">{item.desc}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* 申请表单 */}
          <section className="mt-10 rounded-3xl border border-black/5 bg-w p-5 shadow-sm dark:border-white/10 sm:p-7">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-lg font-semibold tracking-tight t-primary">提交咨询申请</h2>
              <p className="text-xs text-neutral-400">提交后村长会先确认需求，再与你联系</p>
            </div>

            <div className="mt-6 space-y-6">
              <div>
                <p className="text-sm font-medium t-primary">
                  遇到了哪类问题？<span className="ml-1 text-red-500">*</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CATEGORIES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setCategory(item.value)}
                      className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                        category === item.value
                          ? "border-theme bg-theme text-white"
                          : "border-black/10 text-neutral-600 hover:border-theme/40 dark:border-white/10 dark:text-neutral-300"
                      }`}
                    >
                      {item.title}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-sm font-medium t-primary">
                  你希望选择哪种服务？<span className="ml-1 text-red-500">*</span>
                </p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {[
                    ...PACKAGES.map((item) => ({ value: item.value as ConsultPackage, label: `${item.name} ¥${item.price}` })),
                    { value: "unsure" as ConsultPackage, label: "不确定，先帮我评估" },
                  ].map((item) => (
                    <label
                      key={item.value}
                      className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition-colors ${
                        pkg === item.value
                          ? "border-theme bg-theme/5 t-primary"
                          : "border-black/10 text-neutral-600 hover:border-theme/30 dark:border-white/10 dark:text-neutral-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="consult-package"
                        className="accent-[rgb(var(--theme-rgb))]"
                        checked={pkg === item.value}
                        onChange={() => setPkg(item.value)}
                      />
                      <span>{item.label}</span>
                    </label>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium t-primary">
                    目前遇到什么问题？<span className="ml-1 text-red-500">*</span>
                  </p>
                  <span className="text-xs text-neutral-400">
                    {problem.length}/{MAX_PROBLEM}
                  </span>
                </div>
                <textarea
                  value={problem}
                  onChange={(event) => setProblem(event.target.value)}
                  maxLength={MAX_PROBLEM}
                  rows={4}
                  placeholder="例如：已经购买了 VPS，安装 3X-UI 后无法打开面板。"
                  className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-w px-4 py-3 text-sm leading-6 t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500"
                />
              </div>

              <div>
                <div className="flex items-baseline justify-between gap-3">
                  <p className="text-sm font-medium t-primary">
                    希望最终达到什么效果？<span className="ml-1 text-red-500">*</span>
                  </p>
                  <span className="text-xs text-neutral-400">
                    {expected.length}/{MAX_EXPECTED}
                  </span>
                </div>
                <textarea
                  value={expected}
                  onChange={(event) => setExpected(event.target.value)}
                  maxLength={MAX_EXPECTED}
                  rows={3}
                  placeholder="例如：希望能够正常打开面板，并完成基础配置。"
                  className="mt-2 w-full resize-y rounded-xl border border-black/10 bg-w px-4 py-3 text-sm leading-6 t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500"
                />
              </div>

              <div>
                <p className="text-sm font-medium t-primary">
                  联系方式<span className="ml-1 text-red-500">*</span>
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {CONTACT_TYPES.map((item) => (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => setContactType(item.value)}
                      className={`rounded-full border px-3.5 py-2 text-xs font-medium transition-colors ${
                        contactType === item.value
                          ? "border-theme bg-theme text-white"
                          : "border-black/10 text-neutral-600 hover:border-theme/40 dark:border-white/10 dark:text-neutral-300"
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                <input
                  type={contactType === "email" ? "email" : "text"}
                  value={contactAccount}
                  onChange={(event) => setContactAccount(event.target.value)}
                  maxLength={120}
                  placeholder={selectedContact.placeholder}
                  className="mt-3 w-full rounded-xl border border-black/10 bg-w px-4 py-2.5 text-sm t-primary transition-colors placeholder:text-neutral-400 focus:border-black/20 focus:outline-none focus:ring-2 focus:ring-theme/10 dark:border-white/10 dark:placeholder:text-neutral-500"
                />
              </div>

              {/* 蜜罐字段：对用户隐藏 */}
              <input
                type="text"
                tabIndex={-1}
                autoComplete="off"
                aria-hidden="true"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                className="hidden"
              />

              <div className="flex flex-col gap-3 border-t border-black/5 pt-5 dark:border-white/5 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-xs leading-5 text-neutral-400">
                  提交即表示同意村长使用该联系方式与你沟通咨询事项，信息仅用于本次咨询处理。
                </p>
                <ButtonWithLoading title="提交咨询申请" loading={submitting} onClick={submit} />
              </div>
            </div>
          </section>
        </>
      )}

      <AlertUI />
        </div>
      </main>
    </div>
  );
}
