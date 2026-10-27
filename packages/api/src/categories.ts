// 首页栏目分类：文章发布时可勾选归入（可多选），未勾选的文章不进入任何栏目
export interface FeedCategory {
  key: string;
  name: string;
  icon: string;
  color: string;
}

export const FEED_CATEGORIES = [
  { key: "science", name: "科学上网", icon: "ri-shield-keyhole-line", color: "#0f766e" },
  { key: "vps", name: "VPS 服务器", icon: "ri-server-line", color: "#1d4ed8" },
  { key: "ai", name: "AI实测", icon: "ri-robot-2-line", color: "#6d28d9" },
  { key: "domain", name: "域名建站", icon: "ri-global-line", color: "#b45309" },
  { key: "wallet", name: "钱包支付", icon: "ri-wallet-3-line", color: "#047857" },
  { key: "overseas", name: "出海通讯", icon: "ri-send-plane-line", color: "#be123c" },
] as const satisfies readonly FeedCategory[];

export type FeedCategoryKey = (typeof FEED_CATEGORIES)[number]["key"];

export const FEED_CATEGORY_KEYS = FEED_CATEGORIES.map((item) => item.key) as FeedCategoryKey[];

export function isFeedCategoryKey(value: unknown): value is FeedCategoryKey {
  return typeof value === "string" && FEED_CATEGORY_KEYS.includes(value as FeedCategoryKey);
}

export function getFeedCategory(key: string): FeedCategory | undefined {
  return FEED_CATEGORIES.find((item) => item.key === key);
}
