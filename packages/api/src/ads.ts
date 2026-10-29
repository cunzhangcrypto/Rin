// 广告系统共享类型：广告位、素材、投放规则
// 前台只读取服务端净化后的 HTML，后台读取原始 HTML 用于编辑

export const AD_SLOTS = [
  { key: "left", name: "左侧边栏" },
  { key: "right_top", name: "右侧推荐上方" },
  { key: "right_bottom", name: "右侧推荐下方" },
  { key: "inline", name: "文章正文" },
] as const;

export type AdSlotKey = (typeof AD_SLOTS)[number]["key"];

export const AD_SLOT_KEYS: AdSlotKey[] = AD_SLOTS.map((item) => item.key);

export type AdMode = "fixed" | "random" | "weighted";
export const AD_MODES: AdMode[] = ["fixed", "random", "weighted"];

export type AdMaterialType = "html" | "image";

export interface PublicAd {
  id: number;
  type: AdMaterialType;
  html: string;
  image: string;
  url: string;
  title: string;
  weight: number;
}

export interface PublicAdSlot {
  slot: AdSlotKey;
  enabled: boolean;
  mode: AdMode;
  maxCount: number;
  minGap: number;
  ads: PublicAd[];
}

export type PublicAdsResponse = Record<AdSlotKey, PublicAdSlot>;

export interface AdminAdMaterial {
  id: number;
  name: string;
  type: AdMaterialType;
  html: string;
  image: string;
  url: string;
  enabled: boolean;
  weight: number;
  startAt: string | null;
  endAt: string | null;
  slots: AdSlotKey[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminAdSlot {
  slot: AdSlotKey;
  enabled: boolean;
  mode: AdMode;
  maxCount: number;
  minGap: number;
  adIds: number[];
}

export interface AdminAdsResponse {
  materials: AdminAdMaterial[];
  slots: AdminAdSlot[];
}

export interface AdMaterialInput {
  name: string;
  type: AdMaterialType;
  html?: string;
  image?: string;
  url?: string;
  enabled?: boolean;
  weight?: number;
  startAt?: string | null;
  endAt?: string | null;
  slots?: AdSlotKey[];
}

export interface AdSlotInput {
  enabled?: boolean;
  mode?: AdMode;
  maxCount?: number;
  minGap?: number;
}

export interface AdMutationResponse {
  success: boolean;
  id?: number;
}

export function isAdSlotKey(value: unknown): value is AdSlotKey {
  return typeof value === "string" && AD_SLOT_KEYS.includes(value as AdSlotKey);
}

export function isAdMode(value: unknown): value is AdMode {
  return typeof value === "string" && AD_MODES.includes(value as AdMode);
}

export function getAdSlotLabel(key: AdSlotKey): string {
  return AD_SLOTS.find((item) => item.key === key)?.name ?? key;
}
