import { eq, and, like } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { DB } from "../core/hono-types";
import { cache } from "../db/schema";
import { path_join } from "./path";
import { getStorageObject, putStorageObjectAtKey } from "./storage";

// Cache Utils for storing data in memory and persisting to database (with optional S3 backup)

export type CacheStorageMode = 'database' | 's3' | 'kv';

type CacheConfigReader = {
    getOrDefault<T>(key: string, defaultValue: T): Promise<T>;
};

function normalizeCacheEnabled(value: unknown) {
    if (typeof value === "boolean") {
        return value;
    }

    if (typeof value === "string") {
        const normalized = value.trim().toLowerCase();
        if (normalized === "true") {
            return true;
        }
        if (normalized === "false") {
            return false;
        }
    }

    if (typeof value === "number") {
        return value !== 0;
    }

    return Boolean(value);
}

export async function isPublicCacheEnabled(clientConfig: CacheConfigReader) {
    const value = await clientConfig.getOrDefault("cache.enabled", false);
    return normalizeCacheEnabled(value);
}

// 存储提供者接口
interface StorageProvider {
    load(): Promise<void>;
    save(): Promise<void>;
    delete(key: string): Promise<void>;
    clear(): Promise<void>;
}

// 数据库存储提供者
class DatabaseStorageProvider implements StorageProvider {
    constructor(private db: DB, private cacheMap: Map<string, any>, private type: string) {}

    async load(): Promise<void> {
        console.log('Cache load from database', this.type);
        try {
            const rows = await this.db.select().from(cache).where(eq(cache.type, this.type));
            for (const row of rows) {
                try {
                    this.cacheMap.set(row.key, JSON.parse(row.value));
                } catch (e) {
                    this.cacheMap.set(row.key, row.value);
                }
            }
            console.log(`Cache loaded ${rows.length} entries from database`);
        } catch (e: any) {
            console.error('Cache load from database failed');
            console.error(e.message);
        }
    }

    async save(): Promise<void> {
        // Get all existing keys from database for this cache type
        const existingRows = await this.db.select({ key: cache.key }).from(cache).where(eq(cache.type, this.type));
        const existingKeys = new Set(existingRows.map((row: { key: string }) => row.key));
        const currentKeys = new Set(this.cacheMap.keys());

        // Delete keys from database that are no longer in memory
        for (const key of existingKeys) {
            if (!currentKeys.has(key)) {
                await this.db.delete(cache)
                    .where(and(eq(cache.key, key), eq(cache.type, this.type)));
                console.log('Cache removed from database:', key);
            }
        }

        // Save or update current cache entries
        for (const [key, value] of this.cacheMap.entries()) {
            if (value === undefined) {
                console.warn(`Cache: Skipping undefined value for key "${key}"`);
                continue;
            }

            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);

            if (existingKeys.has(key)) {
                await this.db.update(cache)
                    .set({ value: valueStr, updatedAt: new Date() })
                    .where(and(eq(cache.key, key), eq(cache.type, this.type)));
            } else {
                await this.db.insert(cache).values({
                    key,
                    value: valueStr,
                    type: this.type,
                });
            }
        }
    }

    async delete(key: string): Promise<void> {
        try {
            await this.db.delete(cache)
                .where(and(eq(cache.key, key), eq(cache.type, this.type)));
            console.log('Cache deleted from database:', key);
        } catch (e: any) {
            console.error('Cache delete from database failed');
            console.error(e.message);
        }
    }

    async clear(): Promise<void> {
        try {
            await this.db.delete(cache).where(eq(cache.type, this.type));
            console.log('Cache cleared from database');
        } catch (e: any) {
            console.error('Cache clear from database failed');
            console.error(e.message);
        }
    }
}

// S3 存储提供者
class S3StorageProvider implements StorageProvider {
    private cacheKey: string;

    constructor(private env: Env, private cacheMap: Map<string, any>, private type: string) {
        this.cacheKey = path_join(this.env.S3_CACHE_FOLDER || 'cache', `${type}.json`);
    }

    async load(): Promise<void> {
        console.log('Cache load from storage', this.cacheKey);
        try {
            const response = await getStorageObject(this.env, this.cacheKey);
            if (!response) {
                console.log('Cache file not found in storage, starting with empty cache');
                return;
            }
            const data = await response.json<any>();
            for (let key in data) {
                this.cacheMap.set(key, data[key]);
            }
        } catch (e: any) {
            console.error('Cache load from S3 failed');
            console.error(e.message);
        }
    }

    async save(): Promise<void> {
        try {
            await putStorageObjectAtKey(
                this.env,
                this.cacheKey,
                JSON.stringify(Object.fromEntries(this.cacheMap)),
                'application/json'
            ).then(() => {
                console.log('Cache saved to storage');
            }).catch((e: any) => {
                console.error('Cache save to storage failed');
                console.error(e.message);
            });
        } catch (e: any) {
            console.error('Cache save to storage failed');
            console.error(e.message);
        }
    }

    async delete(): Promise<void> {
        await this.save();
    }

    async clear(): Promise<void> {
        await this.save();
    }
}

// KV 配额跟踪器：用 D1 记录每日 KV 使用量，接近免费上限时自动降级
const KV_READ_LIMIT = 80_000;      // 免费 100K/天，留 20% 余量
const KV_WRITE_LIMIT = 800;        // 免费 1K/天，留 20% 余量
const KV_DELETE_LIMIT = 800;       // 免费 1K/天（delete + list 共用）
const KV_TTL_SECONDS = 24 * 60 * 60; // 缓存默认 24 小时过期，自动清理旧数据
const KV_FLUSH_THRESHOLD = 50;     // 内存计数累计 50 次后批量写入 D1
const KV_FLUSH_INTERVAL_MS = 30_000; // 或每 30 秒批量写入一次

class KVQuotaTracker {
    private reads = 0;
    private writes = 0;
    private deletes = 0;
    private lastFlushAt = 0;

    constructor(private db: DB) {
        this.lastFlushAt = Date.now();
    }

    private get today() {
        return new Date().toISOString().slice(0, 10); // UTC 日期
    }

    async ensureTable() {
        try {
            await this.db.run(sql`CREATE TABLE IF NOT EXISTS kv_quota (date TEXT PRIMARY KEY, reads INTEGER NOT NULL DEFAULT 0, writes INTEGER NOT NULL DEFAULT 0, deletes INTEGER NOT NULL DEFAULT 0)`);
        } catch (e: any) {
            console.error('KV quota table init failed', e?.message);
        }
    }

    async flush(force = false) {
        const total = this.reads + this.writes + this.deletes;
        if (total === 0) return;
        const shouldFlush = force || total >= KV_FLUSH_THRESHOLD || (Date.now() - this.lastFlushAt) >= KV_FLUSH_INTERVAL_MS;
        if (!shouldFlush) return;
        const reads = this.reads, writes = this.writes, deletes = this.deletes;
        this.reads = 0; this.writes = 0; this.deletes = 0;
        this.lastFlushAt = Date.now();
        try {
            await this.db.run(sql`
                INSERT INTO kv_quota (date, reads, writes, deletes) VALUES (${this.today}, ${reads}, ${writes}, ${deletes})
                ON CONFLICT(date) DO UPDATE SET
                    reads = kv_quota.reads + ${reads},
                    writes = kv_quota.writes + ${writes},
                    deletes = kv_quota.deletes + ${deletes}
            `);
        } catch (e: any) {
            console.error('KV quota flush failed', e?.message);
        }
    }

    addRead(n = 1) { this.reads += n; this.flush(); }
    addWrite(n = 1) { this.writes += n; this.flush(); }
    addDelete(n = 1) { this.deletes += n; this.flush(); }

    async usage(): Promise<{ reads: number; writes: number; deletes: number }> {
        let stored = { reads: 0, writes: 0, deletes: 0 };
        try {
            const rows = (await this.db.all(sql`SELECT reads, writes, deletes FROM kv_quota WHERE date = ${this.today}`)) as any[];
            if (rows && rows.length > 0) {
                stored = {
                    reads: Number(rows[0].reads) || 0,
                    writes: Number(rows[0].writes) || 0,
                    deletes: Number(rows[0].deletes) || 0,
                };
            }
        } catch (e: any) {
            console.error('KV quota read failed', e?.message);
        }
        return {
            reads: stored.reads + this.reads,
            writes: stored.writes + this.writes,
            deletes: stored.deletes + this.deletes,
        };
    }
}

// KV 存储提供者：缓存写入 Cloudflare KV（边缘高速读取），配额超限自动降级
class KVStorageProvider implements StorageProvider {
    private quota: KVQuotaTracker;
    private degraded = false; // 错误触发的降级（当前 Worker 实例内有效）

    constructor(private db: DB, private kv: KVNamespace, private type: string) {
        this.quota = new KVQuotaTracker(db);
    }

    private key(key: string) {
        return `${this.type}:${key}`;
    }

    async load(): Promise<void> {
        await this.quota.ensureTable();
    }

    async save(): Promise<void> {
        await this.quota.flush(true);
    }

    async clear(): Promise<void> {
        await this.quota.flush(true);
    }

    private async shouldSkipRead(): Promise<boolean> {
        if (this.degraded) return true;
        const usage = await this.quota.usage();
        return usage.reads >= KV_READ_LIMIT;
    }

    private async shouldSkipWrite(): Promise<boolean> {
        if (this.degraded) return true;
        const usage = await this.quota.usage();
        return usage.writes >= KV_WRITE_LIMIT;
    }

    private async shouldSkipDelete(): Promise<boolean> {
        if (this.degraded) return true;
        const usage = await this.quota.usage();
        return usage.deletes >= KV_DELETE_LIMIT;
    }

    async get(key: string): Promise<any | undefined> {
        if (await this.shouldSkipRead()) return undefined;
        try {
            const raw = await this.kv.get(this.key(key));
            this.quota.addRead(1);
            if (raw === null) return undefined;
            try {
                return JSON.parse(raw);
            } catch {
                return raw;
            }
        } catch (e: any) {
            this.degraded = true;
            return undefined;
        }
    }

    async set(key: string, value: any): Promise<void> {
        if (await this.shouldSkipWrite()) return;
        try {
            const valueStr = typeof value === 'string' ? value : JSON.stringify(value);
            await this.kv.put(this.key(key), valueStr, { expirationTtl: KV_TTL_SECONDS });
            this.quota.addWrite(1);
        } catch (e: any) {
            this.degraded = true;
        }
    }

    async delete(key: string): Promise<void> {
        if (await this.shouldSkipDelete()) return;
        try {
            await this.kv.delete(this.key(key));
            this.quota.addDelete(1);
        } catch (e: any) {
            this.degraded = true;
        }
    }

    // 按前缀批量删除（发文章时清缓存用），KV list 操作计入 delete 额度
    async deletePrefix(prefix: string): Promise<void> {
        if (await this.shouldSkipDelete()) return;
        try {
            let cursor: string | undefined;
            do {
                const list = await this.kv.list({ prefix: this.key(prefix), limit: 100, cursor });
                this.quota.addDelete(1);
                if (list.keys.length > 0) {
                    await Promise.all(list.keys.map(k => this.kv.delete(k.name).then(() => this.quota.addDelete(1)).catch(() => {})));
                }
                cursor = list.list_complete ? undefined : list.cursor;
            } while (cursor);
        } catch (e: any) {
            this.degraded = true;
        }
    }
}

export class CacheImpl {
    cache: Map<string, any> = new Map<string, any>();
    db: DB;
    env: Env;
    type: string;
    loaded: boolean = false;
    private storageProvider: StorageProvider;
    private cacheEnabled: Promise<boolean> | null = null;
    private configReader?: CacheConfigReader;
    private isKV: boolean = false;

    constructor(
        db: DB,
        env: Env,
        type: string = "cache",
        storageMode?: CacheStorageMode,
        configReader?: CacheConfigReader,
    ) {
        // 确保 type 不为空，防止不同类型共享同一个存储位置
        if (!type || type.trim() === '') {
            throw new Error('Cache type cannot be empty');
        }
        this.type = type;
        this.db = db;
        this.env = env;
        this.cache = new Map<string, any>();
        this.configReader = configReader;

        // 优先级：参数 > 环境变量，默认为 s3 以向前兼容
        const mode = storageMode ?? (env.CACHE_STORAGE_MODE as CacheStorageMode) ?? 's3';

        // 根据存储模式创建对应的提供者
        if (mode === 'kv' && env.CACHE_KV) {
            this.storageProvider = new KVStorageProvider(db, env.CACHE_KV, type);
            this.isKV = true;
        } else if (mode === 's3') {
            this.storageProvider = new S3StorageProvider(env, this.cache, type);
        } else {
            this.storageProvider = new DatabaseStorageProvider(db, this.cache, type);
        }
    }

    private async isEnabled() {
        // Only the public content cache is gated by `cache.enabled`.
        // Config stores must stay readable, otherwise `cache -> client.config`
        // would recurse back into the same gate and break initialization.
        if (this.type !== "cache") {
            return true;
        }

        if (!this.configReader) {
            return true;
        }

        if (!this.cacheEnabled) {
            this.cacheEnabled = isPublicCacheEnabled(this.configReader);
        }

        return this.cacheEnabled;
    }

    async load() {
        await this.storageProvider.load();
        this.loaded = true;
    }

    async all() {
        if (this.isKV) {
            return new Map<string, any>();
        }
        if (!(await this.isEnabled())) {
            return new Map<string, any>();
        }
        if (!this.loaded) {
            await this.load();
        }
        return this.cache;
    }

    async get(key: string) {
        if (!(await this.isEnabled())) {
            return null;
        }
        if (this.isKV) {
            if (!this.loaded) {
                await this.load();
            }
            return await this.storageProvider.get(key);
        }
        if (!this.loaded) {
            await this.load();
        }
        return this.cache.get(key);
    }

    async getByPrefix(prefix: string): Promise<any[]> {
        if (this.isKV) {
            return [];
        }
        if (!(await this.isEnabled())) {
            return [];
        }
        if (!this.loaded) {
            await this.load();
        }
        const result = [];
        for (let key of this.cache.keys()) {
            if (key.startsWith(prefix)) {
                result.push(this.cache.get(key));
            }
        }
        return result;
    }

    async getBySuffix(suffix: string): Promise<any[]> {
        if (this.isKV) {
            return [];
        }
        if (!(await this.isEnabled())) {
            return [];
        }
        if (!this.loaded) {
            await this.load();
        }
        const result = [];
        for (let key of this.cache.keys()) {
            if (key.endsWith(suffix)) {
                result.push(this.cache.get(key));
            }
        }
        return result;
    }

    async getOrSet<T>(key: string, value: () => Promise<T>) {
        if (!(await this.isEnabled())) {
            return value();
        }
        const cached = await this.get(key);
        if (cached !== undefined) {
            console.log('Cache hit', key);
            return cached as T;
        }
        console.log('Cache miss', key);
        const newValue = await value();
        await this.set(key, newValue);
        return newValue;
    }

    async getOrDefault<T>(key: string, defaultValue: T) {
        if (!(await this.isEnabled())) {
            return defaultValue;
        }
        return this.getOrSet(key, async () => defaultValue);
    }

    async set(key: string, value: any, save: boolean = true) {
        if (!(await this.isEnabled())) {
            return;
        }
        if (this.isKV) {
            if (!this.loaded)
                await this.load();
            await this.storageProvider.set(key, value);
            return;
        }
        if (!this.loaded)
            await this.load();
        this.cache.set(key, value);
        if (save) {
            await this.save();
        }
    }

    async delete(key: string, save: boolean = true) {
        if (this.isKV) {
            if (!this.loaded)
                await this.load();
            await this.storageProvider.delete(key);
            return;
        }
        if (!this.loaded)
            await this.load();
        this.cache.delete(key);
        if (save) {
            await this.storageProvider.delete(key);
        }
    }

    async deletePrefix(prefix: string) {
        if (this.isKV) {
            await (this.storageProvider as KVStorageProvider).deletePrefix(prefix);
            return;
        }
        for (let key of this.cache.keys()) {
            console.log('Cache key', key);
            if (key.startsWith(prefix)) {
                console.log('Cache delete', key);
                await this.delete(key, false);
            }
        }
        await this.save();
    }

    async deleteSuffix(suffix: string) {
        if (this.isKV) {
            return;
        }
        for (let key of this.cache.keys()) {
            console.log("Cache key", key);
            if (key.endsWith(suffix)) {
                console.log("Cache delete", key);
                await this.delete(key, false);
            }
        }
        await this.save();
    }

    async clear() {
        this.cache.clear();
        await this.storageProvider.clear();
    }

    async save() {
        await this.storageProvider.save();
    }

    // Migration helper: Load from S3 and save to database
    async migrateFromS3ToDatabase() {
        console.log('Migrating cache from S3 to database...');
        const s3Provider = new S3StorageProvider(this.env, this.cache, this.type);
        await s3Provider.load();
        const dbProvider = new DatabaseStorageProvider(this.db, this.cache, this.type);
        await dbProvider.save();
        console.log('Migration completed');
    }
}

// Factory functions to create cache instances with context
export function createPublicCache(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "cache", storageMode);
}

export function createServerConfig(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "server.config", storageMode);
}

export function createClientConfig(db: DB, env: Env, storageMode?: CacheStorageMode) {
    return new CacheImpl(db, env, "client.config", storageMode);
}
