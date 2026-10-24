import type {
  ConsultCategory,
  ConsultContactType,
  ConsultNotifyStatus,
  ConsultPackage,
  ConsultPaymentStatus,
  ConsultStatus,
} from "../api/client";

export const CONSULT_CATEGORY_LABELS: Record<ConsultCategory, string> = {
  vps: "VPS / 网络配置",
  ai: "AI 工具使用",
  web: "网站 / Cloudflare",
  other: "其他技术问题",
};

export const CONSULT_PACKAGE_LABELS: Record<ConsultPackage, string> = {
  text: "文字咨询",
  remote: "一对一远程指导",
  full: "完整配置指导",
  unsure: "不确定，先帮我评估",
};

export const CONSULT_PACKAGE_PRICES: Record<ConsultPackage, number> = {
  text: 29,
  remote: 99,
  full: 199,
  unsure: 0,
};

export const CONSULT_CONTACT_LABELS: Record<ConsultContactType, string> = {
  wechat: "微信",
  qq: "QQ",
  telegram: "Telegram",
  email: "Email",
};

export const CONSULT_STATUS_LABELS: Record<ConsultStatus, string> = {
  pending: "待审核",
  accepted: "已接受",
  rejected: "已拒绝",
  processing: "处理中",
  completed: "已完成",
  cancelled: "已取消",
};

export const CONSULT_PAYMENT_LABELS: Record<ConsultPaymentStatus, string> = {
  unpaid: "未付款",
  paid: "已付款",
  refunded: "已退款",
};

export const CONSULT_NOTIFY_LABELS: Record<ConsultNotifyStatus, string> = {
  pending: "待发送",
  sent: "已发送",
  failed: "发送失败",
  skipped: "未配置，已跳过",
};

export function consultStatusClass(status: ConsultStatus): string {
  switch (status) {
    case "accepted":
    case "completed":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "processing":
      return "bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-400";
    case "rejected":
      return "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";
    case "cancelled":
      return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400";
    default:
      return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export function consultPaymentClass(status: ConsultPaymentStatus): string {
  switch (status) {
    case "paid":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "refunded":
      return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400";
    default:
      return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export function consultNotifyClass(status: ConsultNotifyStatus): string {
  switch (status) {
    case "sent":
      return "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400";
    case "failed":
      return "bg-rose-50 text-rose-600 dark:bg-rose-500/10 dark:text-rose-400";
    case "skipped":
      return "bg-neutral-100 text-neutral-500 dark:bg-white/10 dark:text-neutral-400";
    default:
      return "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400";
  }
}

export function formatConsultTime(value: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("zh-CN", { hour12: false });
}

export function consultPackageText(pkg: ConsultPackage, price: number): string {
  const label = CONSULT_PACKAGE_LABELS[pkg] || pkg;
  return price > 0 ? `${label} ¥${price}` : label;
}
