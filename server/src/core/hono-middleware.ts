// Hono middleware for Rin server
import { createMiddleware } from "hono/factory";
import { getCookie, setCookie } from "hono/cookie";
import { drizzle } from "drizzle-orm/d1";
import type { AppContext, Variables, JWTUtils, OAuth2Utils } from "./hono-types";
import { eq } from "drizzle-orm";
import { profileAsync } from "./server-timing";

// Lazy initialization container
class LazyInitContainer {
    private env: Env;
    private instances: Map<string, any> = new Map();
    private initializing: Map<string, Promise<any>> = new Map();

    constructor(env: Env) {
        this.env = env;
    }

    async get<T>(key: string, factory: () => Promise<T>): Promise<T> {
        if (this.instances.has(key)) {
            return this.instances.get(key);
        }

        if (this.initializing.has(key)) {
            return this.initializing.get(key);
        }

        const initPromise = factory().then(instance => {
            this.instances.set(key, instance);
            this.initializing.delete(key);
            return instance;
        });

        this.initializing.set(key, initPromise);
        return initPromise;
    }
}

// Create container per request
export const initContainerMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    await profileAsync(c, "init_container", async () => {
        const container = new LazyInitContainer(c.env);

        const db = await container.get('db', async () => profileAsync(c, "init_db", async () => {
            const schema = await import('../db/schema');
            return drizzle(c.env.DB, { schema });
        }));

        const cache = await container.get('cache', async () => profileAsync(c, "init_cache", async () => {
            const { CacheImpl } = await import('../utils/cache');
            const clientConfig = await container.get('clientConfig', async () => profileAsync(c, "init_client_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "client.config", "database");
            }));
            return new CacheImpl(db, c.env, "cache", undefined, clientConfig);
        }));

        const serverConfig = await container.get('serverConfig', async () => profileAsync(c, "init_server_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "server.config", "database");
            }));

        const clientConfig = await container.get('clientConfig', async () => profileAsync(c, "init_client_config", async () => {
                const { CacheImpl } = await import('../utils/cache');
                return new CacheImpl(db, c.env, "client.config", "database");
            }));

        const jwt = await container.get('jwt', async () => profileAsync(c, "init_jwt", async () => {
            const { default: createJWT } = await import('../utils/jwt');
            const secret = c.env.JWT_SECRET;
            if (!secret) {
                throw new Error('JWT_SECRET is not set');
            }
            return createJWT(secret);
        }));

        let oauth2: OAuth2Utils | undefined = undefined;
        if (c.env.RIN_GITHUB_CLIENT_ID && c.env.RIN_GITHUB_CLIENT_SECRET) {
            oauth2 = await container.get('oauth2', async () => profileAsync(c, "init_oauth2", async () => {
                    const { createOAuthPlugin, GitHubProvider } = await import('../utils/oauth');
                    return createOAuthPlugin({
                        GitHub: new GitHubProvider({
                            clientId: c.env.RIN_GITHUB_CLIENT_ID,
                            clientSecret: c.env.RIN_GITHUB_CLIENT_SECRET
                        })
                    });
                }));
        }

        c.set('db', db);
        c.set('cache', cache);
        c.set('serverConfig', serverConfig);
        c.set('clientConfig', clientConfig);
        c.set('jwt', jwt);
        c.set('oauth2', oauth2);
        c.set('admin', false);
        c.set('env', c.env);
    });

    await next();
});

// 恒定时间比较：先对两边做 SHA-256（统一为固定 32 字节，也遮住原始长度），
// 再逐字节累计差异，耗时与内容无关，避免时序侧信道泄露 API key 信息。
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
    const encoder = new TextEncoder();
    const [ha, hb] = await Promise.all([
        crypto.subtle.digest("SHA-256", encoder.encode(a)),
        crypto.subtle.digest("SHA-256", encoder.encode(b)),
    ]);
    const A = new Uint8Array(ha);
    const B = new Uint8Array(hb);
    let diff = 0;
    for (let i = 0; i < A.length; i++) {
        diff |= A[i] ^ B[i];
    }
    return diff === 0;
}

// Auth middleware - derive user from JWT
export const authMiddleware = createMiddleware<{
    Bindings: Env;
    Variables: Variables;
}>(async (c, next) => {
    await profileAsync(c, "auth_middleware", async () => {
        const jwt = c.get('jwt');
        const db = c.get('db');

        const token = await profileAsync(c, "auth_token", () => {
            const authHeader = c.req.header('authorization');
            if (authHeader && authHeader.startsWith('Bearer ')) {
                return authHeader.substring(7);
            }
            return getCookie(c, 'token');
        });

        const apiKey = c.env.ADMIN_API_KEY;
        let isApiKey = false;
        if (token && apiKey) {
            isApiKey = await timingSafeEqual(token, apiKey);
        }

        if (isApiKey) {
            // 独立 API key：供外部 AI 智能体等非浏览器客户端调用写接口使用，
            // 视为管理员身份（admin 用户以 openid="admin" 标识，与密码登录一致）。
            const { users } = await import("../db/schema");
            const admin = await profileAsync(c, "auth_apikey_admin_lookup", () => db.query.users.findFirst({
                where: eq(users.openid, "admin")
            }));

            if (admin) {
                c.set('uid', admin.id);
                c.set('username', admin.username);
                c.set('admin', admin.permission === 1);
            }
        } else if (token && jwt) {
            const profile = await profileAsync(c, "auth_verify", () => jwt.verify(token));
            if (profile) {
                const { users } = await import("../db/schema");
                const user = await profileAsync(c, "auth_user_lookup", () => db.query.users.findFirst({
                    where: eq(users.id, profile.id)
                }));

                if (user) {
                    c.set('uid', user.id);
                    c.set('username', user.username);
                    c.set('admin', user.permission === 1);
                }
            }
        }
    });

    await next();
});

// Helper to set JWT cookie
export function setJWTCookie(c: AppContext, token: string) {
    setCookie(c, 'token', token, {
        expires: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7),
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
    });
}

// Helper to clear JWT cookie
export function clearJWTCookie(c: AppContext) {
    setCookie(c, 'token', '', {
        expires: new Date(0),
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
    });
}
