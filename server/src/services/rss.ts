import { and, desc, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { AppContext } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feeds, info, users } from "../db/schema";
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

    const baseUrl = env['SITE_URL'] || frontendUrl;

    const [siteNameRow, siteDescRow] = await Promise.all([
        db.select().from(info).where(eq(info.key, 'site.name')).execute(),
        db.select().from(info).where(eq(info.key, 'site.description')).execute(),
    ]);

    const siteName = siteNameRow[0]?.value || env.RSS_TITLE || "Web3村长";
    const siteDesc = siteDescRow[0]?.value || env.RSS_DESCRIPTION || "分享AIGC、互联网科技、跨境工具、网络媒体知识";

    const feedConfig: any = {
        title: siteName,
        description: siteDesc,
        id: baseUrl,
        link: baseUrl,
        copyright: `All rights reserved ${new Date().getFullYear()}`,
        generator: siteName,
        feedLinks: {
            rss: `${baseUrl}/rss.xml`,
            json: `${baseUrl}/rss.json`,
            atom: `${baseUrl}/atom.xml`,
        },
    };

    const queryConfig = {
        where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
        orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
        limit: 100,
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

export async function rssCrontab(env: any, db: DB, frontendUrl?: string) {
    const baseUrl = env['SITE_URL'] || frontendUrl || "";
    if (!baseUrl) {
        console.warn("RSS Crontab: SITE_URL 未设置，生成的 Feed 链接将为空。请在 Cloudflare Worker 环境变量中添加 SITE_URL=https://www.cunzhangblog.com");
        return;
    }

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
