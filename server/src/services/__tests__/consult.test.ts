import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { ConsultService } from '../consult';
import { Hono } from "hono";
import type { Variables } from "../../core/hono-types";
import { setupTestApp, cleanupTestDB } from '../../../tests/fixtures';
import type { Database } from 'bun:sqlite';

const CONSULT_TABLE_SQL = `
    CREATE TABLE IF NOT EXISTS consult_requests (
        id INTEGER PRIMARY KEY,
        request_no TEXT NOT NULL UNIQUE,
        category TEXT NOT NULL,
        package_type TEXT NOT NULL,
        package_price INTEGER DEFAULT 0 NOT NULL,
        problem TEXT NOT NULL,
        expected TEXT NOT NULL,
        contact_type TEXT NOT NULL,
        contact_account TEXT NOT NULL,
        status TEXT DEFAULT 'pending' NOT NULL,
        payment_status TEXT DEFAULT 'unpaid' NOT NULL,
        admin_note TEXT DEFAULT '' NOT NULL,
        is_read INTEGER DEFAULT 0 NOT NULL,
        read_at INTEGER,
        notify_status TEXT DEFAULT 'pending' NOT NULL,
        notified_at INTEGER,
        notify_error TEXT DEFAULT '' NOT NULL,
        notify_attempts INTEGER DEFAULT 0 NOT NULL,
        ip_hash TEXT DEFAULT '' NOT NULL,
        created_at INTEGER DEFAULT (unixepoch()) NOT NULL,
        updated_at INTEGER DEFAULT (unixepoch()) NOT NULL
    );
    CREATE UNIQUE INDEX IF NOT EXISTS consult_requests_request_no_idx ON consult_requests (request_no);
`;

const validBody = (overrides: Record<string, unknown> = {}) => ({
    category: "vps",
    package: "text",
    problem: "已经购买了 VPS，安装 3X-UI 后无法打开面板",
    expected: "希望能够正常打开面板，并完成基础配置",
    contactType: "wechat",
    contactAccount: "example123",
    ...overrides,
});

async function waitFor(check: () => boolean, timeout = 3000) {
    const start = Date.now();
    while (Date.now() - start < timeout) {
        if (check()) return true;
        await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return false;
}

describe('ConsultService', () => {
    let sqlite: Database;
    let env: Env;
    let app: Hono<{ Bindings: Env; Variables: Variables }>;

    beforeEach(async () => {
        const ctx = await setupTestApp(ConsultService);
        sqlite = ctx.sqlite;
        env = ctx.env;
        app = ctx.app;

        sqlite.exec(CONSULT_TABLE_SQL);
        sqlite.exec(`
            INSERT INTO users (id, username, openid, avatar, permission)
            VALUES (1, 'admin', 'gh_admin', 'admin.png', 1),
                   (2, 'regular', 'gh_regular', 'regular.png', 0)
        `);
    });

    afterEach(() => {
        cleanupTestDB(sqlite);
    });

    const adminHeaders = () => ({
        authorization: 'Bearer mock_token_1',
        'content-type': 'application/json',
    });
    const userHeaders = () => ({
        authorization: 'Bearer mock_token_2',
        'content-type': 'application/json',
    });

    const submit = (body: Record<string, unknown>) =>
        app.request('/', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify(body),
        }, env);

    describe('POST / - 公开提交', () => {
        it('保存申请并返回申请编号，价格由服务端决定', async () => {
            const res = await submit(validBody({ packagePrice: 1, price: 1 }));
            expect(res.status).toBe(200);

            const data = await res.json() as { id: number; requestNo: string };
            expect(data.requestNo).toMatch(/^ZX-\d{8}-001$/);

            const row = sqlite.query("SELECT * FROM consult_requests WHERE id = ?").get(data.id) as any;
            expect(row.package_price).toBe(29);
            expect(row.status).toBe('pending');
            expect(row.payment_status).toBe('unpaid');
            expect(row.is_read).toBe(0);
            expect(row.contact_account).toBe('example123');
            expect(row.ip_hash.length).toBe(64);
        });

        it('拒绝非法字段与格式', async () => {
            expect((await submit(validBody({ category: 'bad' }))).status).toBe(400);
            expect((await submit(validBody({ package: 'bad' }))).status).toBe(400);
            expect((await submit(validBody({ problem: '短' }))).status).toBe(400);
            expect((await submit(validBody({ expected: '' }))).status).toBe(400);
            expect((await submit(validBody({ contactType: 'bad' }))).status).toBe(400);
            expect((await submit(validBody({ contactType: 'email', contactAccount: 'not-an-email' }))).status).toBe(400);
        });

        it('蜜罐字段有值时拒绝提交且不落库', async () => {
            const res = await submit(validBody({ website: 'spam' }));
            expect(res.status).toBe(400);
            const count = sqlite.query("SELECT COUNT(*) AS total FROM consult_requests").get() as any;
            expect(count.total).toBe(0);
        });

        it('拦截短时间内的重复提交', async () => {
            const first = await submit(validBody());
            expect(first.status).toBe(200);
            const second = await submit(validBody());
            expect([409, 429]).toContain(second.status);

            const count = sqlite.query("SELECT COUNT(*) AS total FROM consult_requests").get() as any;
            expect(count.total).toBe(1);
        });

        it('Telegram 未配置时仍保存申请，并标记为 skipped', async () => {
            const res = await submit(validBody());
            expect(res.status).toBe(200);
            const data = await res.json() as { id: number };

            const rows = () => sqlite.query("SELECT notify_status FROM consult_requests WHERE id = ?").get(data.id) as any;
            await waitFor(() => rows()?.notify_status === 'skipped');
            expect(rows()?.notify_status).toBe('skipped');
        });

        it('Telegram 发送失败不影响申请保存', async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = (async () => {
                throw new Error('network down');
            }) as any;

            try {
                const ctx = await setupTestApp(ConsultService, {
                    TELEGRAM_BOT_TOKEN: 'test-token',
                    TELEGRAM_CHAT_ID: 'test-chat',
                    SITE_URL: 'https://example.com',
                });
                const localSqlite = ctx.sqlite;
                try {
                    localSqlite.exec(CONSULT_TABLE_SQL);
                    const res = await ctx.app.request('/', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify(validBody()),
                    }, ctx.env);
                    expect(res.status).toBe(200);
                    const data = await res.json() as { id: number };

                    const rows = () => localSqlite.query("SELECT notify_status, notify_error FROM consult_requests WHERE id = ?").get(data.id) as any;
                    await waitFor(() => rows()?.notify_status === 'failed');
                    expect(rows()?.notify_status).toBe('failed');
                    expect(rows()?.notify_error).toContain('network down');
                } finally {
                    cleanupTestDB(localSqlite);
                }
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });

    describe('管理端鉴权', () => {
        it('未登录返回 401，普通用户返回 403', async () => {
            expect((await app.request('/admin/list', { method: 'GET' }, env)).status).toBe(401);
            expect((await app.request('/admin/list', { method: 'GET', headers: userHeaders() }, env)).status).toBe(403);
            expect((await app.request('/admin/unread', { method: 'GET', headers: userHeaders() }, env)).status).toBe(403);
        });
    });

    describe('GET /admin/*', () => {
        const seed = () => {
            sqlite.exec(`
                INSERT INTO consult_requests
                    (id, request_no, category, package_type, package_price, problem, expected, contact_type, contact_account, created_at, updated_at)
                VALUES
                    (1, 'ZX-20261024-001', 'vps', 'text', 29, '面板打不开', '正常打开', 'wechat', 'wx01', unixepoch() - 100, unixepoch() - 100),
                    (2, 'ZX-20261024-002', 'ai', 'remote', 99, 'API 不会配', '接入模型', 'telegram', 'tg01', unixepoch(), unixepoch())
            `);
        };

        it('列表按时间倒序并支持筛选与分页', async () => {
            seed();
            const res = await app.request('/admin/list', { method: 'GET', headers: adminHeaders() }, env);
            expect(res.status).toBe(200);
            const data = await res.json() as any;
            expect(data.total).toBe(2);
            expect(data.data[0].requestNo).toBe('ZX-20261024-002');
            expect(data.data[0].isRead).toBe(false);

            const filtered = await app.request('/admin/list?category=ai&package=remote&q=002', { method: 'GET', headers: adminHeaders() }, env);
            const filteredData = await filtered.json() as any;
            expect(filteredData.total).toBe(1);
            expect(filteredData.data[0].category).toBe('ai');

            const paged = await app.request('/admin/list?page=2&limit=1', { method: 'GET', headers: adminHeaders() }, env);
            const pagedData = await paged.json() as any;
            expect(pagedData.data.length).toBe(1);
            expect(pagedData.data[0].requestNo).toBe('ZX-20261024-001');
        });

        it('未读数与最近通知', async () => {
            seed();
            const res = await app.request('/admin/unread', { method: 'GET', headers: adminHeaders() }, env);
            const data = await res.json() as any;
            expect(data.unread).toBe(2);
            expect(data.items.length).toBe(2);
        });

        it('查看详情自动标记已读，且已读与处理状态独立', async () => {
            seed();
            const res = await app.request('/admin/1', { method: 'GET', headers: adminHeaders() }, env);
            expect(res.status).toBe(200);
            const detail = await res.json() as any;
            expect(detail.isRead).toBe(true);
            expect(detail.status).toBe('pending');
            expect(detail.readAt).toBeTruthy();

            const row = sqlite.query("SELECT is_read, read_at, status FROM consult_requests WHERE id = 1").get() as any;
            expect(row.is_read).toBe(1);
            expect(row.read_at).toBeTruthy();
            expect(row.status).toBe('pending');

            const unread = await app.request('/admin/unread', { method: 'GET', headers: adminHeaders() }, env);
            expect((await unread.json() as any).unread).toBe(1);
        });

        it('更新处理状态、付款状态与备注', async () => {
            seed();
            const res = await app.request('/admin/2', {
                method: 'POST',
                headers: adminHeaders(),
                body: JSON.stringify({ status: 'processing', paymentStatus: 'paid', adminNote: '已联系' }),
            }, env);
            expect(res.status).toBe(200);

            const row = sqlite.query("SELECT status, payment_status, admin_note FROM consult_requests WHERE id = 2").get() as any;
            expect(row.status).toBe('processing');
            expect(row.payment_status).toBe('paid');
            expect(row.admin_note).toBe('已联系');

            const bad = await app.request('/admin/2', {
                method: 'POST',
                headers: adminHeaders(),
                body: JSON.stringify({ status: 'not-a-status' }),
            }, env);
            expect(bad.status).toBe(400);
        });

        it('删除咨询记录', async () => {
            seed();
            const res = await app.request('/admin/1', { method: 'DELETE', headers: adminHeaders() }, env);
            expect(res.status).toBe(200);
            const row = sqlite.query("SELECT id FROM consult_requests WHERE id = 1").get();
            expect(row).toBeNull();
        });
    });

    describe('Telegram 手动重试', () => {
        async function setupWithTelegram() {
            const ctx = await setupTestApp(ConsultService, {
                TELEGRAM_BOT_TOKEN: 'test-token',
                TELEGRAM_CHAT_ID: 'test-chat',
                SITE_URL: 'https://example.com',
            });
            ctx.sqlite.exec(CONSULT_TABLE_SQL);
            ctx.sqlite.exec(`
                INSERT INTO users (id, username, openid, avatar, permission)
                VALUES (1, 'admin', 'gh_admin', 'admin.png', 1)
            `);
            ctx.sqlite.exec(`
                INSERT INTO consult_requests
                    (id, request_no, category, package_type, package_price, problem, expected, contact_type, contact_account, notify_status, notify_error, created_at, updated_at)
                VALUES (1, 'ZX-20261024-001', 'vps', 'text', 29, '面板打不开', '正常打开', 'wechat', 'wx01', 'failed', 'boom', unixepoch(), unixepoch())
            `);
            return ctx;
        }

        it('重试成功后标记 sent，再次重试返回 409', async () => {
            const originalFetch = globalThis.fetch;
            let calls = 0;
            globalThis.fetch = (async () => {
                calls += 1;
                return new Response(JSON.stringify({ ok: true }), { status: 200 });
            }) as any;

            const ctx = await setupWithTelegram();
            try {
                const headers = { authorization: 'Bearer mock_token_1', 'content-type': 'application/json' };
                const res = await ctx.app.request('/admin/1/notify-retry', { method: 'POST', headers }, ctx.env);
                expect(res.status).toBe(200);
                expect((await res.json() as any).success).toBe(true);
                expect(calls).toBe(1);

                const row = ctx.sqlite.query("SELECT notify_status, notified_at, notify_attempts FROM consult_requests WHERE id = 1").get() as any;
                expect(row.notify_status).toBe('sent');
                expect(row.notified_at).toBeTruthy();
                expect(row.notify_attempts).toBe(1);

                const again = await ctx.app.request('/admin/1/notify-retry', { method: 'POST', headers }, ctx.env);
                expect(again.status).toBe(409);
                expect(calls).toBe(1);
            } finally {
                cleanupTestDB(ctx.sqlite);
                globalThis.fetch = originalFetch;
            }
        });

        it('重试失败时记录错误并返回 failed', async () => {
            const originalFetch = globalThis.fetch;
            globalThis.fetch = (async () =>
                new Response(JSON.stringify({ ok: false, description: 'chat not found' }), { status: 400 })) as any;

            const ctx = await setupWithTelegram();
            try {
                const headers = { authorization: 'Bearer mock_token_1', 'content-type': 'application/json' };
                const res = await ctx.app.request('/admin/1/notify-retry', { method: 'POST', headers }, ctx.env);
                expect(res.status).toBe(200);
                const data = await res.json() as any;
                expect(data.success).toBe(false);
                expect(data.notifyStatus).toBe('failed');
                expect(data.notifyError).toContain('chat not found');

                const row = ctx.sqlite.query("SELECT notify_status, notify_error, notify_attempts FROM consult_requests WHERE id = 1").get() as any;
                expect(row.notify_status).toBe('failed');
                expect(row.notify_error).toContain('chat not found');
                expect(row.notify_attempts).toBe(1);
            } finally {
                cleanupTestDB(ctx.sqlite);
                globalThis.fetch = originalFetch;
            }
        });
    });
});
