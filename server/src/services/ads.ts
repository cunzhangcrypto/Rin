import { asc, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import {
  AD_SLOT_KEYS,
  AD_SLOTS,
  isAdMode,
  isAdSlotKey,
  type AdminAdsResponse,
  type AdminAdMaterial,
  type AdminAdSlot,
  type AdSlotKey,
  type PublicAd,
  type PublicAdsResponse,
} from "@rin/api";
import { adLinks, adSlots, ads } from "../db/schema";
import type { AppContext } from "../core/hono-types";
import { isSafeUrl, MAX_AD_HTML_LENGTH, sanitizeAdHtml } from "../utils/sanitize-html";

const PUBLIC_CACHE_KEY = "ads:public";
const MAX_NAME = 60;
const MAX_WEIGHT = 1000;
const MAX_INLINE_COUNT = 5;
const MAX_MIN_GAP = 20;

type AdRow = typeof ads.$inferSelect;
type LinkRow = typeof adLinks.$inferSelect;
type SlotRow = typeof adSlots.$inferSelect;

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function toMs(value: unknown): number | null {
  if (!value) return null;
  if (value instanceof Date) return value.getTime();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function isWithinSchedule(row: AdRow, now: number): boolean {
  const start = toMs(row.startAt);
  const end = toMs(row.endAt);
  if (start !== null && start > now) return false;
  if (end !== null && end < now) return false;
  return true;
}

function toPublicAd(row: AdRow): PublicAd {
  return {
    id: row.id,
    type: row.type === "image" ? "image" : "html",
    html: row.type === "image" ? "" : row.htmlSanitized,
    image: row.image,
    url: row.url,
    title: row.name,
    weight: row.weight,
  };
}

function toAdminMaterial(row: AdRow, slots: AdSlotKey[]): AdminAdMaterial {
  return {
    id: row.id,
    name: row.name,
    type: row.type === "image" ? "image" : "html",
    html: row.html,
    image: row.image,
    url: row.url,
    enabled: row.enabled === 1,
    weight: row.weight,
    startAt: toIso(row.startAt),
    endAt: toIso(row.endAt),
    slots,
    createdAt: toIso(row.createdAt) ?? "",
    updatedAt: toIso(row.updatedAt) ?? "",
  };
}

function toAdminSlot(row: SlotRow | undefined, slot: AdSlotKey, adIds: number[]): AdminAdSlot {
  return {
    slot,
    enabled: row ? row.enabled === 1 : true,
    mode: row && isAdMode(row.mode) ? row.mode : "weighted",
    maxCount: row?.maxCount ?? 1,
    minGap: row?.minGap ?? 3,
    adIds,
  };
}

async function clearAdsCache(c: AppContext) {
  try {
    await c.get("cache").delete(PUBLIC_CACHE_KEY);
  } catch (error) {
    console.error("[ads] cache invalidate failed", error instanceof Error ? error.message : error);
  }
}

function requireAdmin(c: AppContext) {
  if (!c.get("uid")) return c.json({ error: "Unauthorized" }, 401);
  if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);
  return null;
}

type ParsedInput = {
  name: string;
  type: "html" | "image";
  html: string;
  htmlSanitized: string;
  image: string;
  url: string;
  enabled: number;
  weight: number;
  startAt: Date | null;
  endAt: Date | null;
  slots: AdSlotKey[];
};

function parseInput(body: Record<string, unknown>): ParsedInput | { error: string } {
  const name = String(body.name ?? "").trim();
  if (!name) return { error: "请填写广告名称" };
  if (name.length > MAX_NAME) return { error: `广告名称不能超过 ${MAX_NAME} 个字符` };

  const type = body.type === "image" ? "image" : "html";
  const rawHtml = String(body.html ?? "").trim();
  const image = String(body.image ?? "").trim();
  const url = String(body.url ?? "").trim();

  if (type === "image") {
    if (!image) return { error: "图片广告需要填写图片地址" };
    if (!isSafeUrl(image)) return { error: "图片地址不合法（仅支持 http/https 或站内路径）" };
    if (url && !isSafeUrl(url)) return { error: "跳转链接不合法（仅支持 http/https 或站内路径）" };
  } else {
    if (!rawHtml) return { error: "请填写广告 HTML 代码" };
    if (rawHtml.length > MAX_AD_HTML_LENGTH) return { error: "HTML 代码过长" };
  }
  if (url && !isSafeUrl(url)) return { error: "跳转链接不合法（仅支持 http/https 或站内路径）" };

  const htmlSanitized = type === "html" ? sanitizeAdHtml(rawHtml) : "";
  if (type === "html" && !htmlSanitized) {
    return { error: "HTML 代码为空或包含不被允许的内容（script、事件属性、危险样式等）" };
  }

  const weightRaw = Number(body.weight);
  const weight = Number.isFinite(weightRaw) ? Math.min(MAX_WEIGHT, Math.max(0, Math.round(weightRaw))) : 10;

  const enabled = body.enabled === false || body.enabled === 0 ? 0 : 1;

  const parseDate = (value: unknown): Date | null => {
    if (value === null || value === undefined || value === "") return null;
    const date = new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
  };
  const startAt = parseDate(body.startAt);
  const endAt = parseDate(body.endAt);
  if (startAt && endAt && endAt.getTime() < startAt.getTime()) {
    return { error: "结束时间不能早于开始时间" };
  }

  const slots = Array.isArray(body.slots)
    ? Array.from(new Set(body.slots.filter(isAdSlotKey))) as AdSlotKey[]
    : [];

  return {
    name,
    type,
    html: type === "html" ? rawHtml : "",
    htmlSanitized,
    image: type === "image" ? image : "",
    url,
    enabled,
    weight,
    startAt,
    endAt,
    slots,
  };
}

async function saveLinks(c: AppContext, adId: number, slots: AdSlotKey[]) {
  const db = c.get("db");
  await db.delete(adLinks).where(eq(adLinks.adId, adId));
  if (slots.length === 0) return;
  await db.insert(adLinks).values(slots.map((slot, index) => ({
    adId,
    slot,
    sortOrder: index,
  })));
}

export function AdsService(): Hono {
  const app = new Hono();

  // GET /ads - 前台读取全部广告位（服务端已净化 HTML，客户端只做随机选择）
  app.get("/", async (c: AppContext) => {
    try {
      const cached = await c.get("cache").get(PUBLIC_CACHE_KEY);
      if (cached) return c.json(cached);
    } catch {
      // 缓存不可用时直接读库
    }

    const db = c.get("db");
    const [slotRows, linkRows, adRows] = await Promise.all([
      db.select().from(adSlots),
      db.select().from(adLinks).orderBy(asc(adLinks.sortOrder), asc(adLinks.id)),
      db.select().from(ads),
    ]);

    const now = Date.now();
    const adById = new Map(adRows.map((row) => [row.id, row]));
    const result = {} as PublicAdsResponse;

    for (const key of AD_SLOT_KEYS) {
      const conf = slotRows.find((row) => row.slot === key);
      const orderedIds = linkRows.filter((row) => row.slot === key).map((row) => row.adId);
      const eligibleAds = orderedIds
        .map((id) => adById.get(id))
        .filter((row): row is AdRow => Boolean(row))
        .filter((row) => row.enabled === 1 && isWithinSchedule(row, now))
        .map(toPublicAd)
        .filter((ad) => ad.type === "image" || ad.html.length > 0);

      result[key] = {
        slot: key,
        enabled: conf ? conf.enabled === 1 : true,
        mode: conf && isAdMode(conf.mode) ? conf.mode : "weighted",
        maxCount: Math.min(MAX_INLINE_COUNT, Math.max(1, conf?.maxCount ?? 1)),
        minGap: Math.min(MAX_MIN_GAP, Math.max(1, conf?.minGap ?? 3)),
        ads: eligibleAds,
      };
    }

    try {
      await c.get("cache").set(PUBLIC_CACHE_KEY, result);
    } catch {
      // 忽略缓存写入失败
    }

    return c.json(result);
  });

  // GET /ads/admin - 后台素材与广告位配置
  app.get("/admin", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const db = c.get("db");
    const [adRows, linkRows, slotRows] = await Promise.all([
      db.select().from(ads).orderBy(desc(ads.updatedAt), desc(ads.id)),
      db.select().from(adLinks).orderBy(asc(adLinks.sortOrder), asc(adLinks.id)),
      db.select().from(adSlots),
    ]);

    const slotsByAd = new Map<number, AdSlotKey[]>();
    const idsBySlot = new Map<AdSlotKey, number[]>();
    for (const link of linkRows) {
      if (!isAdSlotKey(link.slot)) continue;
      const list = slotsByAd.get(link.adId) ?? [];
      list.push(link.slot);
      slotsByAd.set(link.adId, list);
      const ids = idsBySlot.get(link.slot) ?? [];
      ids.push(link.adId);
      idsBySlot.set(link.slot, ids);
    }

    const response: AdminAdsResponse = {
      materials: adRows.map((row) => toAdminMaterial(row, slotsByAd.get(row.id) ?? [])),
      slots: AD_SLOT_KEYS.map((key) => toAdminSlot(
        slotRows.find((row) => row.slot === key),
        key,
        idsBySlot.get(key) ?? [],
      )),
    };

    return c.json(response);
  });

  // POST /ads/admin/preview - 使用与保存一致的净化规则生成预览 HTML
  app.post("/admin/preview", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: "请求格式错误" }, 400);

    const html = String(body.html ?? "");
    if (html.length > MAX_AD_HTML_LENGTH) {
      return c.json({ error: "HTML 代码过长" }, 400);
    }

    return c.json({ html: sanitizeAdHtml(html) });
  });

  // POST /ads/admin/ad - 新建素材
  app.post("/admin/ad", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: "请求格式错误" }, 400);

    const parsed = parseInput(body);
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    const db = c.get("db");
    const now = new Date();
    const inserted = await db.insert(ads).values({
      name: parsed.name,
      type: parsed.type,
      html: parsed.html,
      htmlSanitized: parsed.htmlSanitized,
      image: parsed.image,
      url: parsed.url,
      enabled: parsed.enabled,
      weight: parsed.weight,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: ads.id });

    const id = inserted[0]?.id;
    if (!id) return c.json({ error: "保存失败" }, 500);

    await saveLinks(c, id, parsed.slots);
    await clearAdsCache(c);
    return c.json({ success: true, id });
  });

  // POST /ads/admin/ad/:id - 更新素材
  app.post("/admin/ad/:id", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const id = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Bad request" }, 400);

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: "请求格式错误" }, 400);

    const db = c.get("db");
    const existing = await db.query.ads.findFirst({ where: eq(ads.id, id), columns: { id: true } });
    if (!existing) return c.json({ error: "Not found" }, 404);

    const parsed = parseInput(body);
    if ("error" in parsed) return c.json({ error: parsed.error }, 400);

    await db.update(ads).set({
      name: parsed.name,
      type: parsed.type,
      html: parsed.html,
      htmlSanitized: parsed.htmlSanitized,
      image: parsed.image,
      url: parsed.url,
      enabled: parsed.enabled,
      weight: parsed.weight,
      startAt: parsed.startAt,
      endAt: parsed.endAt,
      updatedAt: new Date(),
    }).where(eq(ads.id, id));

    await saveLinks(c, id, parsed.slots);
    await clearAdsCache(c);
    return c.json({ success: true, id });
  });

  // POST /ads/admin/ad/:id/duplicate - 复制素材（默认停用，避免立刻重复展示）
  app.post("/admin/ad/:id/duplicate", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const id = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Bad request" }, 400);

    const db = c.get("db");
    const row = await db.query.ads.findFirst({ where: eq(ads.id, id) });
    if (!row) return c.json({ error: "Not found" }, 404);

    const now = new Date();
    const name = `${row.name.slice(0, MAX_NAME - 3)} 副本`;
    const inserted = await db.insert(ads).values({
      name,
      type: row.type,
      html: row.html,
      htmlSanitized: row.htmlSanitized,
      image: row.image,
      url: row.url,
      enabled: 0,
      weight: row.weight,
      startAt: row.startAt,
      endAt: row.endAt,
      createdAt: now,
      updatedAt: now,
    }).returning({ id: ads.id });

    const newId = inserted[0]?.id;
    if (!newId) return c.json({ error: "复制失败" }, 500);

    const links = await db.select().from(adLinks).where(eq(adLinks.adId, id));
    if (links.length > 0) {
      await db.insert(adLinks).values(links.map((link) => ({
        adId: newId,
        slot: link.slot,
        sortOrder: link.sortOrder,
      })));
    }

    await clearAdsCache(c);
    return c.json({ success: true, id: newId });
  });

  // DELETE /ads/admin/ad/:id - 删除素材及其关联
  app.delete("/admin/ad/:id", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const id = Number.parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) return c.json({ error: "Bad request" }, 400);

    const db = c.get("db");
    await db.delete(adLinks).where(eq(adLinks.adId, id));
    await db.delete(ads).where(eq(ads.id, id));
    await clearAdsCache(c);
    return c.json({ success: true });
  });

  // POST /ads/admin/slot/:slot - 更新广告位配置
  app.post("/admin/slot/:slot", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const slot = c.req.param("slot");
    if (!isAdSlotKey(slot)) return c.json({ error: "广告位无效" }, 400);

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) return c.json({ error: "请求格式错误" }, 400);

    const updates: Record<string, unknown> = { updatedAt: new Date() };
    if (body.enabled !== undefined) updates.enabled = body.enabled === false || body.enabled === 0 ? 0 : 1;
    if (body.mode !== undefined) {
      if (!isAdMode(body.mode)) return c.json({ error: "展示模式无效" }, 400);
      updates.mode = body.mode;
    }
    if (body.maxCount !== undefined) {
      const count = Number(body.maxCount);
      if (!Number.isFinite(count)) return c.json({ error: "每篇最大展示数量无效" }, 400);
      updates.maxCount = Math.min(MAX_INLINE_COUNT, Math.max(1, Math.round(count)));
    }
    if (body.minGap !== undefined) {
      const gap = Number(body.minGap);
      if (!Number.isFinite(gap)) return c.json({ error: "最小段落间隔无效" }, 400);
      updates.minGap = Math.min(MAX_MIN_GAP, Math.max(1, Math.round(gap)));
    }

    const db = c.get("db");
    const existing = await db.query.adSlots.findFirst({ where: eq(adSlots.slot, slot) });
    if (existing) {
      await db.update(adSlots).set(updates).where(eq(adSlots.slot, slot));
    } else {
      const defaults = { enabled: 1, mode: "weighted", maxCount: 1, minGap: 3, createdAt: new Date(), updatedAt: new Date() };
      await db.insert(adSlots).values({ slot, ...defaults, ...updates } as typeof adSlots.$inferInsert);
    }

    await clearAdsCache(c);
    return c.json({ success: true });
  });

  // POST /ads/admin/slot/:slot/links - 设置广告位关联素材及排序
  app.post("/admin/slot/:slot/links", async (c: AppContext) => {
    const denied = requireAdmin(c);
    if (denied) return denied;

    const slot = c.req.param("slot");
    if (!isAdSlotKey(slot)) return c.json({ error: "广告位无效" }, 400);

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body || !Array.isArray(body.adIds)) return c.json({ error: "请求格式错误" }, 400);

    const ids = Array.from(new Set(body.adIds.map((value) => Number(value)).filter((value) => Number.isInteger(value) && value > 0)));

    const db = c.get("db");
    if (ids.length > 0) {
      const rows = await db.select({ id: ads.id }).from(ads);
      const existing = new Set(rows.map((row) => row.id));
      if (ids.some((id) => !existing.has(id))) return c.json({ error: "包含不存在的广告" }, 400);
    }

    await db.delete(adLinks).where(eq(adLinks.slot, slot));
    if (ids.length > 0) {
      await db.insert(adLinks).values(ids.map((adId, index) => ({ adId, slot, sortOrder: index })));
    }

    await clearAdsCache(c);
    return c.json({ success: true });
  });

  // 供后台页面展示广告位名称
  app.get("/admin/slots", (c: AppContext) => c.json(AD_SLOTS));

  return app;
}
