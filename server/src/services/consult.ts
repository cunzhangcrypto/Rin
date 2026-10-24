import { and, count, desc, eq, gte, like, lte, type SQL } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { Hono } from "hono";
import { consultRequests } from "../db/schema";
import type { AppContext, DB } from "../core/hono-types";

const CATEGORY_LABELS: Record<string, string> = {
  vps: "VPS / 网络配置",
  ai: "AI 工具使用",
  web: "网站 / Cloudflare",
  other: "其他技术问题",
};

const PACKAGE_LABELS: Record<string, string> = {
  text: "文字咨询",
  remote: "一对一远程指导",
  full: "完整配置指导",
  unsure: "不确定，先帮我评估",
};

// 服务端价格白名单：价格只由套餐类型决定，忽略客户端传入的任何价格
const PACKAGE_PRICES: Record<string, number> = {
  text: 29,
  remote: 99,
  full: 199,
  unsure: 0,
};

const CONTACT_LABELS: Record<string, string> = {
  wechat: "微信",
  qq: "QQ",
  telegram: "Telegram",
  email: "Email",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "待审核",
  accepted: "已接受",
  rejected: "已拒绝",
  processing: "处理中",
  completed: "已完成",
  cancelled: "已取消",
};

const STATUS_VALUES = Object.keys(STATUS_LABELS);
const PAYMENT_VALUES = ["unpaid", "paid", "refunded"];

const MAX_PROBLEM = 2000;
const MAX_EXPECTED = 1500;
const MAX_CONTACT = 120;
const MAX_NOTE = 2000;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

// 公开提交限流：同一 IP 10 分钟内最多 5 条，两次提交至少间隔 20 秒
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_MAX = 5;
const RATE_MIN_INTERVAL_MS = 20 * 1000;
// 相同联系方式 + 相同问题在 5 分钟内视为重复提交
const DUPLICATE_WINDOW_MS = 5 * 60 * 1000;

function shanghaiParts(date: Date) {
  const shifted = new Date(date.getTime() + 8 * 60 * 60 * 1000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, "0");
  const d = String(shifted.getUTCDate()).padStart(2, "0");
  const hh = String(shifted.getUTCHours()).padStart(2, "0");
  const mm = String(shifted.getUTCMinutes()).padStart(2, "0");
  return { ymd: `${y}${m}${d}`, display: `${y}-${m}-${d} ${hh}:${mm}` };
}

async function sha256Hex(value: string): Promise<string> {
  const buffer = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(buffer))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function nextRequestNo(db: DB, ymd: string): Promise<string> {
  const prefix = `ZX-${ymd}-`;
  const rows = await db
    .select({ requestNo: consultRequests.requestNo })
    .from(consultRequests)
    .where(like(consultRequests.requestNo, `${prefix}%`))
    .orderBy(desc(consultRequests.requestNo))
    .limit(1);
  const last = rows[0]?.requestNo?.slice(prefix.length) || "0";
  const seq = (parseInt(last, 10) || 0) + 1;
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function toIso(value: unknown): string | null {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString();
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toListItem(row: any) {
  return {
    id: row.id,
    requestNo: row.requestNo,
    category: row.category,
    package: row.packageType,
    packagePrice: row.packagePrice,
    contactType: row.contactType,
    contactAccount: row.contactAccount,
    status: row.status,
    paymentStatus: row.paymentStatus,
    isRead: row.isRead === 1,
    notifyStatus: row.notifyStatus,
    createdAt: toIso(row.createdAt),
    updatedAt: toIso(row.updatedAt),
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function toDetail(row: any) {
  return {
    ...toListItem(row),
    problem: row.problem,
    expected: row.expected,
    adminNote: row.adminNote,
    readAt: toIso(row.readAt),
    notifiedAt: toIso(row.notifiedAt),
    notifyError: row.notifyError,
    notifyAttempts: row.notifyAttempts,
  };
}

function truncate(value: string, max: number) {
  return value.length > max ? `${value.slice(0, max)}…` : value;
}

function buildTelegramMessage(row: {
  id: number;
  requestNo: string;
  category: string;
  packageType: string;
  packagePrice: number;
  problem: string;
  expected: string;
  contactType: string;
  contactAccount: string;
  createdAt: Date;
}, adminUrl: string) {
  const packageLabel = PACKAGE_LABELS[row.packageType] || row.packageType;
  const priceSuffix = row.packagePrice > 0 ? ` ¥${row.packagePrice}` : "";
  // 纯文本发送（不启用 parse_mode），用户输入不会被当作 Markdown/HTML 解析
  return [
    "📩 收到新的付费咨询申请",
    "",
    `申请编号：${row.requestNo}`,
    `咨询类型：${CATEGORY_LABELS[row.category] || row.category}`,
    `咨询套餐：${packageLabel}${priceSuffix}`,
    "遇到的问题：",
    truncate(row.problem, 800),
    "",
    "期望效果：",
    truncate(row.expected, 500),
    "",
    "联系方式：",
    `${CONTACT_LABELS[row.contactType] || row.contactType}：${truncate(row.contactAccount, MAX_CONTACT)}`,
    `提交时间：${shanghaiParts(row.createdAt).display}`,
    "状态：待审核",
    "",
    "查看详情：",
    adminUrl,
  ]
    .join("\n")
    .slice(0, 4000);
}

type NotifyResult = { status: "sent" | "failed" | "skipped"; error: string };

async function sendConsultNotification(
  env: Env,
  db: DB,
  row: {
    id: number;
    requestNo: string;
    category: string;
    packageType: string;
    packagePrice: number;
    problem: string;
    expected: string;
    contactType: string;
    contactAccount: string;
    createdAt: Date;
  },
  origin: string,
): Promise<NotifyResult> {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chatId = env.TELEGRAM_CHAT_ID;

  if (!token || !chatId) {
    await db
      .update(consultRequests)
      .set({ notifyStatus: "skipped", notifyError: "Telegram 未配置", updatedAt: new Date() })
      .where(eq(consultRequests.id, row.id));
    return { status: "skipped", error: "Telegram 未配置" };
  }

  const adminUrl = `${env.SITE_URL || origin}/admin/consult/${row.id}`;
  const text = buildTelegramMessage(row, adminUrl);

  try {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
    });
    const payload = (await response.json().catch(() => null)) as { ok?: boolean; description?: string } | null;
    if (!response.ok || !payload?.ok) {
      throw new Error(payload?.description || `Telegram HTTP ${response.status}`);
    }

    await db
      .update(consultRequests)
      .set({
        notifyStatus: "sent",
        notifiedAt: new Date(),
        notifyError: "",
        notifyAttempts: sql`${consultRequests.notifyAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(consultRequests.id, row.id));
    return { status: "sent", error: "" };
  } catch (error) {
    const message = truncate(error instanceof Error ? error.message : String(error), 500);
    await db
      .update(consultRequests)
      .set({
        notifyStatus: "failed",
        notifyError: message,
        notifyAttempts: sql`${consultRequests.notifyAttempts} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(consultRequests.id, row.id));
    return { status: "failed", error: message };
  }
}

function runInBackground(c: AppContext, task: Promise<unknown>): Promise<unknown> | null {
  try {
    c.executionCtx.waitUntil(task);
    return null;
  } catch {
    // 没有 ExecutionContext 时（本地/测试环境）退化为同步等待，避免后台任务被提前终止
    return task.catch(() => {});
  }
}

export function ConsultService(): Hono {
  const app = new Hono();

  // POST /consult - 公开提交咨询申请
  app.post("/", async (c: AppContext) => {
    const db = c.get("db");

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return c.json({ error: "请求格式错误" }, 400);
    }

    // 蜜罐字段：正常用户不会填写
    if (typeof body.website === "string" && body.website.trim() !== "") {
      return c.json({ error: "提交失败，请稍后再试" }, 400);
    }

    const category = String(body.category || "");
    const packageType = String(body.package || "");
    const problem = String(body.problem || "").trim();
    const expected = String(body.expected || "").trim();
    const contactType = String(body.contactType || "");
    const contactAccount = String(body.contactAccount || "").trim();

    if (!CATEGORY_LABELS[category]) {
      return c.json({ error: "请选择咨询类型" }, 400);
    }
    if (!(packageType in PACKAGE_PRICES)) {
      return c.json({ error: "请选择咨询套餐" }, 400);
    }
    if (problem.length < 5) {
      return c.json({ error: "请把遇到的问题描述得更具体一些（至少 5 个字）" }, 400);
    }
    if (problem.length > MAX_PROBLEM) {
      return c.json({ error: `问题描述不能超过 ${MAX_PROBLEM} 个字符` }, 400);
    }
    if (expected.length < 3) {
      return c.json({ error: "请填写期望达到的效果" }, 400);
    }
    if (expected.length > MAX_EXPECTED) {
      return c.json({ error: `期望效果不能超过 ${MAX_EXPECTED} 个字符` }, 400);
    }
    if (!CONTACT_LABELS[contactType]) {
      return c.json({ error: "请选择联系方式" }, 400);
    }
    if (contactAccount.length < 2 || contactAccount.length > MAX_CONTACT) {
      return c.json({ error: `联系方式需在 2-${MAX_CONTACT} 个字符之间` }, 400);
    }
    if (contactType === "email" && !EMAIL_PATTERN.test(contactAccount)) {
      return c.json({ error: "邮箱格式不正确" }, 400);
    }

    const ip = c.req.header("cf-connecting-ip") || c.req.header("x-forwarded-for") || "unknown";
    const ipHash = await sha256Hex(ip.split(",")[0].trim());

    const now = new Date();

    // 限流：同一 IP 10 分钟内最多 5 条，且两次提交间隔不小于 20 秒
    try {
      const recentCountRows = await db
        .select({ count: count() })
        .from(consultRequests)
        .where(and(eq(consultRequests.ipHash, ipHash), gte(consultRequests.createdAt, new Date(now.getTime() - RATE_WINDOW_MS))));
      if ((recentCountRows[0]?.count || 0) >= RATE_MAX) {
        return c.json({ error: "提交过于频繁，请稍后再试" }, 429);
      }

      const lastRow = await db.query.consultRequests.findFirst({
        where: eq(consultRequests.ipHash, ipHash),
        columns: { createdAt: true },
        orderBy: [desc(consultRequests.createdAt)],
      });
      const lastAt = lastRow?.createdAt ? new Date(lastRow.createdAt).getTime() : 0;
      if (lastAt && now.getTime() - lastAt < RATE_MIN_INTERVAL_MS) {
        return c.json({ error: "提交过于频繁，请稍后再试" }, 429);
      }

      const duplicate = await db.query.consultRequests.findFirst({
        where: and(
          eq(consultRequests.contactAccount, contactAccount),
          eq(consultRequests.problem, problem),
          gte(consultRequests.createdAt, new Date(now.getTime() - DUPLICATE_WINDOW_MS)),
        ),
        columns: { id: true },
      });
      if (duplicate) {
        return c.json({ error: "你刚刚提交过相同的咨询申请，请勿重复提交" }, 409);
      }
    } catch (error) {
      console.error("[consult] rate limit check failed", error instanceof Error ? error.message : error);
    }

    const { ymd } = shanghaiParts(now);
    const packagePrice = PACKAGE_PRICES[packageType];

    let inserted: { id: number; requestNo: string } | null = null;
    let lastError: unknown = null;
    for (let attempt = 0; attempt < 5 && !inserted; attempt += 1) {
      try {
        const requestNo = await nextRequestNo(db, ymd);
        const rows = await db
          .insert(consultRequests)
          .values({
            requestNo,
            category,
            packageType,
            packagePrice,
            problem,
            expected,
            contactType,
            contactAccount,
            status: "pending",
            paymentStatus: "unpaid",
            adminNote: "",
            isRead: 0,
            notifyStatus: "pending",
            notifyAttempts: 0,
            notifyError: "",
            ipHash,
            createdAt: now,
            updatedAt: now,
          })
          .returning({ id: consultRequests.id, requestNo: consultRequests.requestNo });
        inserted = rows[0] || null;
      } catch (error) {
        lastError = error;
      }
    }

    if (!inserted) {
      console.error("[consult] insert failed", lastError instanceof Error ? lastError.message : lastError);
      return c.json({ error: "提交失败，请稍后再试" }, 500);
    }

    // 数据库保存成功后立即返回；Telegram 通知在后台执行，失败不影响申请
    const origin = new URL(c.req.url).origin;
    const background = runInBackground(
      c,
      sendConsultNotification(c.env, db, {
        id: inserted.id,
        requestNo: inserted.requestNo,
        category,
        packageType,
        packagePrice,
        problem,
        expected,
        contactType,
        contactAccount,
        createdAt: now,
      }, origin),
    );
    // 仅在拿不到 ExecutionContext 时同步等待，正常情况下不阻塞响应
    if (background) await background;

    return c.json({ id: inserted.id, requestNo: inserted.requestNo });
  });

  // GET /consult/admin/unread - 未读数量 + 最近通知
  app.get("/admin/unread", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const db = c.get("db");
    const unreadRows = await db
      .select({ count: count() })
      .from(consultRequests)
      .where(eq(consultRequests.isRead, 0));
    const recent = await db.select().from(consultRequests).orderBy(desc(consultRequests.createdAt)).limit(10);

    return c.json({
      unread: unreadRows[0]?.count || 0,
      items: recent.map(toListItem),
    });
  });

  // GET /consult/admin/list - 咨询列表（筛选/搜索/分页）
  app.get("/admin/list", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const db = c.get("db");
    const page = Math.max(1, parseInt(c.req.query("page") || "1", 10) || 1);
    const limitRaw = parseInt(c.req.query("limit") || "20", 10) || 20;
    const limit = Math.min(50, Math.max(1, limitRaw));

    const q = (c.req.query("q") || "").trim().slice(0, 40);
    const category = c.req.query("category") || "";
    const packageType = c.req.query("package") || "";
    const status = c.req.query("status") || "";
    const payment = c.req.query("payment") || "";
    const dateFrom = c.req.query("dateFrom") || "";
    const dateTo = c.req.query("dateTo") || "";

    const conditions: SQL[] = [];
    if (q) conditions.push(like(consultRequests.requestNo, `%${q}%`));
    if (CATEGORY_LABELS[category]) conditions.push(eq(consultRequests.category, category));
    if (packageType in PACKAGE_PRICES) conditions.push(eq(consultRequests.packageType, packageType));
    if (STATUS_VALUES.includes(status)) conditions.push(eq(consultRequests.status, status));
    if (PAYMENT_VALUES.includes(payment)) conditions.push(eq(consultRequests.paymentStatus, payment));
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateFrom)) {
      conditions.push(gte(consultRequests.createdAt, new Date(`${dateFrom}T00:00:00+08:00`)));
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateTo)) {
      conditions.push(lte(consultRequests.createdAt, new Date(`${dateTo}T23:59:59+08:00`)));
    }

    const where = conditions.length > 0 ? and(...conditions) : undefined;

    const totalRows = where
      ? await db.select({ count: count() }).from(consultRequests).where(where)
      : await db.select({ count: count() }).from(consultRequests);
    const total = totalRows[0]?.count || 0;

    const rows = where
      ? await db
          .select()
          .from(consultRequests)
          .where(where)
          .orderBy(desc(consultRequests.createdAt))
          .limit(limit)
          .offset((page - 1) * limit)
      : await db
          .select()
          .from(consultRequests)
          .orderBy(desc(consultRequests.createdAt))
          .limit(limit)
          .offset((page - 1) * limit);

    return c.json({ total, page, limit, data: rows.map(toListItem) });
  });

  // GET /consult/admin/:id - 详情（管理员打开即自动标记已读）
  app.get("/admin/:id", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Bad request" }, 400);
    }

    const db = c.get("db");
    const row = await db.query.consultRequests.findFirst({ where: eq(consultRequests.id, id) });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }

    if (row.isRead === 0) {
      const readAt = new Date();
      await db
        .update(consultRequests)
        .set({ isRead: 1, readAt, updatedAt: readAt })
        .where(eq(consultRequests.id, id));
      row.isRead = 1;
      row.readAt = readAt;
    }

    return c.json(toDetail(row));
  });

  // POST /consult/admin/:id - 更新处理状态 / 付款状态 / 备注
  app.post("/admin/:id", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Bad request" }, 400);
    }

    const body = (await c.req.json().catch(() => null)) as Record<string, unknown> | null;
    if (!body) {
      return c.json({ error: "请求格式错误" }, 400);
    }

    const db = c.get("db");
    const row = await db.query.consultRequests.findFirst({
      where: eq(consultRequests.id, id),
      columns: { id: true },
    });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (body.status !== undefined) {
      if (!STATUS_VALUES.includes(String(body.status))) {
        return c.json({ error: "处理状态无效" }, 400);
      }
      updates.status = String(body.status);
    }
    if (body.paymentStatus !== undefined) {
      if (!PAYMENT_VALUES.includes(String(body.paymentStatus))) {
        return c.json({ error: "付款状态无效" }, 400);
      }
      updates.paymentStatus = String(body.paymentStatus);
    }
    if (body.adminNote !== undefined) {
      const note = String(body.adminNote);
      if (note.length > MAX_NOTE) {
        return c.json({ error: `备注不能超过 ${MAX_NOTE} 个字符` }, 400);
      }
      updates.adminNote = note;
    }

    await db.update(consultRequests).set(updates).where(eq(consultRequests.id, id));
    return c.json({ success: true });
  });

  // POST /consult/admin/:id/notify-retry - 手动重试 Telegram 通知
  app.post("/admin/:id/notify-retry", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Bad request" }, 400);
    }

    const db = c.get("db");
    const row = await db.query.consultRequests.findFirst({ where: eq(consultRequests.id, id) });
    if (!row) {
      return c.json({ error: "Not found" }, 404);
    }
    if (row.notifyStatus === "sent") {
      return c.json({ error: "该申请已成功通知，无需重复推送" }, 409);
    }

    const origin = new URL(c.req.url).origin;
    const result = await sendConsultNotification(c.env, db, {
      id: row.id,
      requestNo: row.requestNo,
      category: row.category,
      packageType: row.packageType,
      packagePrice: row.packagePrice,
      problem: row.problem,
      expected: row.expected,
      contactType: row.contactType,
      contactAccount: row.contactAccount,
      createdAt: new Date(row.createdAt),
    }, origin);

    return c.json({ success: result.status === "sent", notifyStatus: result.status, notifyError: result.error });
  });

  // DELETE /consult/admin/:id - 删除咨询记录
  app.delete("/admin/:id", async (c: AppContext) => {
    const uid = c.get("uid");
    if (!uid) return c.json({ error: "Unauthorized" }, 401);
    if (!c.get("admin")) return c.json({ error: "Permission denied" }, 403);

    const id = parseInt(c.req.param("id"), 10);
    if (!Number.isFinite(id) || id <= 0) {
      return c.json({ error: "Bad request" }, 400);
    }

    const db = c.get("db");
    await db.delete(consultRequests).where(eq(consultRequests.id, id));
    return c.json({ success: true });
  });

  return app;
}
