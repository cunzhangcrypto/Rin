import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feeds, users } from "../db/schema";
import { extractImage } from "../utils/image";
import { path_join } from "../utils/path";
import { getStorageObject, getStoragePublicUrl, headStorageObject, putStorageObjectAtKey } from "../utils/storage";
import { FAVICON_ALLOWED_TYPES, getFaviconKey } from "./favicon";
import type { DB } from "../core/hono-types";

// Lazy-loaded modules for RSS generation
let Feed: any;
let unified: any;
let remarkParse: any;
let remarkGfm: any;
let remarkRehype: any;
let rehypeStringify: any;

async function initRSSModules() {
    if (!Feed) {
        const feed = await import("feed");
        Feed = feed.Feed;
    }
    if (!unified) {
        const [u, rp, rg, rr, rs] = await Promise.all([
            import("unified"),
            import("remark-parse"),
            import("remark-gfm"),
            import("remark-rehype"),
            import("rehype-stringify")
        ]);
        unified = u.unified;
        remarkParse = rp.default;
        remarkGfm = rg.default;
        remarkRehype = rr.default;
        rehypeStringify = rs.default;
    }
}

export function RSSService(): Hono {
    const app = new Hono();
    const handlers = ['/rss.xml', '/atom.xml', '/rss.json', '/feed.json'];
    
    handlers.forEach(path => {
        app.get(path, async (c: AppContext) => {
            return handleFeed(c, path.split('/').pop()!);
        });
    });

    app.get('/feed.xml', async (c: AppContext) => {
        return c.redirect('/rss.xml', 301);
    });

    return app;
}

async function handleFeed(c: AppContext, fileName: string) {
    const env = c.get('env');
    const db = c.get('db');
    const folder = env.S3_CACHE_FOLDER || 'cache/';

    const contentTypeMap: Record<string, string> = {
        'rss.xml': 'application/rss+xml; charset=UTF-8',
        'atom.xml': 'application/atom+xml; charset=UTF-8',
        'rss.json': 'application/feed+json; charset=UTF-8',
        'feed.json': 'application/feed+json; charset=UTF-8',
    };

    const key = path_join(folder, fileName);
    
    try {
        const response = await profileAsync(c, 'rss_s3_fetch', () => getStorageObject(env, key));
        if (response) {
            const text = await response.text();
            return c.text(text, 200, {
                'Content-Type': contentTypeMap[fileName] || 'application/xml',
                'Cache-Control': 'public, max-age=3600',
            });
        }
    } catch (e: any) {}
    
    try {
        const url = new URL(c.req.url);
        const frontendUrl = `${url.protocol}//${url.host}`;
        
        const feed = await profileAsync(c, 'rss_generate_feed', () => generateFeed(env, db, frontendUrl, c));
        
        let content: string;
        if (fileName.endsWith('.json')) {
            content = feed.json1();
        } else if (fileName === 'atom.xml') {
            content = feed.atom1();
        } else {
            content = feed.rss2();
        }
        
        return c.text(content, 200, {
            'Content-Type': contentTypeMap[fileName] || 'application/xml',
            'Cache-Control': 'public, max-age=300',
        });
    } catch (genError: any) {
        return c.text(`RSS generation failed: ${genError.message}`, 500);
    }
}

async function generateFeed(env: any, db: DB, frontendUrl: string, c?: AppContext) {
    if (c) {
        await profileAsync(c, 'rss_init_modules', () => initRSSModules());
    } else {
        await initRSSModules();
    }

    // 修正点：使用索引访问 ['SITE_URL'] 绕过 Env 类型定义的限制
    const baseUrl = env['SITE_URL'] || frontendUrl;

    const feedConfig: any = {
        title: env.RSS_TITLE || "Rin Feed",
        description: env.RSS_DESCRIPTION || "Feed from Rin",
        id: baseUrl,
        link: baseUrl,
        copyright: `All rights reserved ${new Date().getFullYear()}`,
        generator: "Feed from Rin",
        feedLinks: {
            rss: `${baseUrl}/rss.xml`,
            json: `${baseUrl}/rss.json`,
            atom: `${baseUrl}/atom.xml`,
        },
    };

    const queryConfig = {
        where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: 20,
        columns: {
            id: true,
            alias: true, 
            title: true,
            summary: true,
            content: true,
            createdAt: true,
            updatedAt: true,
        },
        with: {
            user: { columns: { id: true, username: true, avatar: true } },
        },
    };

    const feed_list = (await db.query.feeds.findMany(queryConfig as any)) as any[];
    const feed = new Feed(feedConfig);

    for (const f of feed_list) {
        let contentHtml = '';
        if (f.content) {
            try {
                const file = await unified()
                    .use(remarkParse)
                    .use(remarkGfm)
                    .use(remarkRehype)
                    .use(rehypeStringify)
                    .process(f.content);
                contentHtml = file.toString();
            } catch (e) {
                contentHtml = f.content;
            }
        }

        const itemPath = f.alias ? `/${f.alias}` : `/feed/${f.id}`;
        const absoluteLink = baseUrl ? `${baseUrl}${itemPath}` : itemPath;

        feed.addItem({
            title: f.title || "No title",
            id: f.id?.toString() || "0",
            link: absoluteLink, 
            date: f.createdAt,
            description: f.summary || (f.content ? f.content.slice(0, 100) : ""),
            content: contentHtml,
            author: f.user ? [{ name: f.user.username }] : undefined,
            image: extractImage(f.content),
        });
    }
    
    return feed;
}

export async function rssCrontab(env: any, db: DB) {
    // 自动获取环境变量中的 SITE_URL，确保定时任务生成的链接是完整的
    const baseUrl = env['SITE_URL'] || ""; 
    
    // 如果你确定没有环境变量，必须在这里填入一个默认的，否则定时任务生成的 XML 永远没有域名
    const feed = await generateFeed(env, db, baseUrl);
    
    const folder = env.S3_CACHE_FOLDER || "cache/";

    async function save(name: string, data: string) {
        const hashkey = path_join(folder, name);
        try {
            await putStorageObjectAtKey(
                env,
                hashkey,
                data,
                name.endsWith('.json') ? 'application/json' : 'application/xml'
            );
        } catch (e: any) {}
    }

    await Promise.all([
        save("rss.xml", feed.rss2()),
        save("atom.xml", feed.atom1()),
        save("rss.json", feed.json1())
    ]);
}
