import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, unique } from "drizzle-orm/sqlite-core";

const created_at = integer("created_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull();
const updated_at = integer("updated_at", { mode: 'timestamp' }).default(sql`(unixepoch())`).notNull();

export const feeds = sqliteTable("feeds", {
    id: integer("id").primaryKey(),
    alias: text("alias"),
    title: text("title"),
    summary: text("summary").default("").notNull(),
    ai_summary: text("ai_summary").default("").notNull(),
    ai_summary_status: text("ai_summary_status").default("idle").notNull(),
    ai_summary_error: text("ai_summary_error").default("").notNull(),
    content: text("content").notNull(),
    listed: integer("listed").default(1).notNull(),
    draft: integer("draft").default(1).notNull(),
    top: integer("top").default(0).notNull(),
    recommended: integer("recommended").default(0).notNull(),
    recommendOrder: integer("recommend_order").default(0).notNull(),
    ai_visible: integer("ai_visible").default(0).notNull(),
    // 首页栏目（逗号分隔的 key 列表，如 "vps,ai"），为空表示不进入任何栏目
    categories: text("categories").default("").notNull(),
    uid: integer("uid").references(() => users.id).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const moments = sqliteTable("moments", {
    id: integer("id").primaryKey(),
    content: text("content").notNull(),
    uid: integer("uid").references(() => users.id).notNull(),
    createdAt: created_at,
    updatedAt: updated_at
});

export const visits = sqliteTable("visits", {
    id: integer("id").primaryKey(),
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    ip: text("ip").notNull(),
    createdAt: created_at,
});

export const visitStats = sqliteTable("visit_stats", {
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull().primaryKey(),
    pv: integer("pv").default(0).notNull(),
    hllData: text("hll_data").default("").notNull(),
    updatedAt: updated_at,
});

export const info = sqliteTable("info", {
    key: text("key").notNull().unique(),
    value: text("value").notNull(),
});

export const friends = sqliteTable("friends", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    desc: text("desc"),
    avatar: text("avatar").notNull(),
    url: text("url").notNull(),
    uid: integer("uid").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    accepted: integer("accepted").default(0).notNull(),
    health: text("health").default("").notNull(),
    sort_order: integer("sort_order").default(0).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const users = sqliteTable("users", {
    id: integer("id").primaryKey(),
    username: text("username").notNull(),
    openid: text("openid").notNull(),
    avatar: text("avatar"),
    password: text("password"),
    permission: integer("permission").default(0),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const comments = sqliteTable("comments", {
    id: integer("id").primaryKey(),
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    userId: integer("user_id").references(() => users.id, { onDelete: 'cascade' }).notNull(),
    content: text("content").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const consultRequests = sqliteTable("consult_requests", {
    id: integer("id").primaryKey(),
    requestNo: text("request_no").notNull().unique(),
    category: text("category").notNull(),
    packageType: text("package_type").notNull(),
    packagePrice: integer("package_price").default(0).notNull(),
    problem: text("problem").notNull(),
    expected: text("expected").notNull(),
    contactType: text("contact_type").notNull(),
    contactAccount: text("contact_account").notNull(),
    status: text("status").default("pending").notNull(),
    paymentStatus: text("payment_status").default("unpaid").notNull(),
    adminNote: text("admin_note").default("").notNull(),
    isRead: integer("is_read").default(0).notNull(),
    readAt: integer("read_at", { mode: 'timestamp' }),
    notifyStatus: text("notify_status").default("pending").notNull(),
    notifiedAt: integer("notified_at", { mode: 'timestamp' }),
    notifyError: text("notify_error").default("").notNull(),
    notifyAttempts: integer("notify_attempts").default(0).notNull(),
    // IP 哈希（不可逆），仅用于限流与防重复提交，不保存原始 IP
    ipHash: text("ip_hash").default("").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const hashtags = sqliteTable("hashtags", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

export const feedHashtags = sqliteTable("feed_hashtags", {
    feedId: integer("feed_id").references(() => feeds.id, { onDelete: 'cascade' }).notNull(),
    hashtagId: integer("hashtag_id").references(() => hashtags.id, { onDelete: 'cascade' }).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

// 广告素材：html 为后台粘贴的原始代码，html_sanitized 为服务端白名单净化后的结果
export const ads = sqliteTable("ads", {
    id: integer("id").primaryKey(),
    name: text("name").notNull(),
    type: text("type").default("html").notNull(),
    html: text("html").default("").notNull(),
    htmlSanitized: text("html_sanitized").default("").notNull(),
    image: text("image").default("").notNull(),
    url: text("url").default("").notNull(),
    enabled: integer("enabled").default(1).notNull(),
    weight: integer("weight").default(10).notNull(),
    startAt: integer("start_at", { mode: 'timestamp' }),
    endAt: integer("end_at", { mode: 'timestamp' }),
    createdAt: created_at,
    updatedAt: updated_at,
});

// 广告位配置：每个广告位独立的启用状态、展示模式与正文插入参数
export const adSlots = sqliteTable("ad_slots", {
    slot: text("slot").primaryKey(),
    enabled: integer("enabled").default(1).notNull(),
    mode: text("mode").default("weighted").notNull(),
    maxCount: integer("max_count").default(1).notNull(),
    minGap: integer("min_gap").default(3).notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
});

// 广告位与素材的多对多关联（同一素材可投放到多个广告位）
export const adLinks = sqliteTable("ad_links", {
    id: integer("id").primaryKey(),
    adId: integer("ad_id").references(() => ads.id, { onDelete: 'cascade' }).notNull(),
    slot: text("slot").notNull(),
    sortOrder: integer("sort_order").default(0).notNull(),
    createdAt: created_at,
}, (table) => ({
    adSlotUnique: unique().on(table.adId, table.slot),
}));

export const cache = sqliteTable("cache", {
    id: integer("id").primaryKey(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    type: text("type").default("cache").notNull(),
    createdAt: created_at,
    updatedAt: updated_at,
}, (table) => ({
    // 复合唯一约束：key + type
    keyTypeUnique: unique().on(table.key, table.type),
}));

export const feedsRelations = relations(feeds, ({ many, one }) => ({
    hashtags: many(feedHashtags),
    user: one(users, {
        fields: [feeds.uid],
        references: [users.id],
    }),
    comments: many(comments),
}));

export const momentsRelations = relations(moments, ({ one }) => ({
    user: one(users, {
        fields: [moments.uid],
        references: [users.id],
    })
}));

export const commentsRelations = relations(comments, ({ one }) => ({
    feed: one(feeds, {
        fields: [comments.feedId],
        references: [feeds.id],
    }),
    user: one(users, {
        fields: [comments.userId],
        references: [users.id],
    }),
}));

export const hashtagsRelations = relations(hashtags, ({ many }) => ({
    feeds: many(feedHashtags),
}));

export const adsRelations = relations(ads, ({ many }) => ({
    links: many(adLinks),
}));

export const feedHashtagsRelations = relations(feedHashtags, ({ one }) => ({
    feed: one(feeds, {
        fields: [feedHashtags.feedId],
        references: [feeds.id],
    }),
    hashtag: one(hashtags, {
        fields: [feedHashtags.hashtagId],
        references: [hashtags.id],
    }),
}));

export const adLinksRelations = relations(adLinks, ({ one }) => ({
    ad: one(ads, {
        fields: [adLinks.adId],
        references: [ads.id],
    }),
}));
