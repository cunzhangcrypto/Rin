import { and, desc, eq, sql } from "drizzle-orm";
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
let FeedModule: any;

async function initRSSModules() {
    if (!Feed && !FeedModule) {
        FeedModule = await import("feed");
        Feed = FeedModule.Feed;
    }
}

// Simple markdown-to-plain-text conversion (no heavy npm modules)
function mdToPlainText(md: string): string {
    return md
        .replace(/```[\s\S]*?```/g, '')           // remove code blocks
        .replace(/!\[.*?\]\(.*?\)/g, '')           // remove images
        .replace(/\[([^\]]*)\]\(.*?\)/g, '$1')     // convert links to text
        .replace(/[#*_~`>|\\\-]{1,}/g, '')         // remove formatting chars
        .replace(/\n{3,}/g, '\n\n')                // normalize newlines
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .trim();
}

// Lightweight markdown-to-HTML for RSS content (avoids heavy unified/remark/rehype stack)
function mdToHtml(md: string): string {
    let html = md
        // Code blocks
        .replace(/```(\w*)\n?([\s\S]*?)```/g, '<pre><code>$2</code></pre>')
        // Inline code
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        // Images
        .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />')
        // Links
        .replace(/\[([^\]]*)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
        // Bold + italic
        .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
        .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
        .replace(/\*(.+?)\*/g, '<em>$1</em>')
        // Headers
        .replace(/^### (.+)$/gm, '<h3>$1</h3>')
        .replace(/^## (.+)$/gm, '<h2>$1</h2>')
        .replace(/^# (.+)$/gm, '<h1>$1</h1>')
        // Blockquotes
        .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
        // Horizontal rules
        .replace(/^---$/gm, '<hr />')
        // Line breaks -> wrap in paragraphs
        .replace(/\n\n/g, '</p><p>')
        // Remaining single newlines -> <br />
        .replace(/\n/g, '<br />');

    return `<p>${html}</p>`;
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

    // 轻量级 Sitemap 数据接口：只返回 URL + 日期，不含正文，供 Sitemap Worker 使用
    // 支持分页：/sitemap-posts.json?per_page=500&page=1
    // 默认一次性返回最多 5000 篇，超出需分页
    app.get('/sitemap-posts.json', async (c: AppContext) => {
        const env = c.get('env');
        const db = c.get('db');
        const baseUrl = env['SITE_URL'] || `${new URL(c.req.url).protocol}//${new URL(c.req.url).host}`;

        const rawPerPage = c.req.query('per_page');
        const rawPage = c.req.query('page');
        const perPage = rawPerPage ? Math.min(Math.max(parseInt(rawPerPage, 10) || 500, 1), 5000) : 5000;
        const page = rawPage ? Math.max(parseInt(rawPage, 10) || 1, 1) : 1;
        const offset = (page - 1) * perPage;

        const [posts, countResult] = await Promise.all([
            db.query.feeds.findMany({
                where: and(eq(feeds.draft, 0), eq(feeds.listed, 1)),
                orderBy: [desc(feeds.createdAt), desc(feeds.updatedAt)],
                limit: perPage,
                offset: offset,
                columns: {
                    id: true,
                    alias: true,
                    title: true,
                    summary: true,
                    createdAt: true,
                    updatedAt: true,
                },
            }),
            db.select({ count: sql<number>`count(*)` }).from(feeds).where(and(eq(feeds.draft, 0), eq(feeds.listed, 1))).execute(),
        ]);

        const total = Number(countResult[0]?.count || 0);
        const totalPages = Math.ceil(total / perPage);

        const items = posts.map((p) => ({
            url: p.alias ? `${baseUrl}/${p.alias}` : `${baseUrl}/feed/${p.id}`,
            title: p.title,
            summary: p.summary,
            lastmod: p.updatedAt || p.createdAt,
        }));

        return c.json({
            items,
            pagination: {
                page,
                perPage,
                total,
                totalPages,
                hasNext: page < totalPages,
                hasPrev: page > 1,
            },
        }, 200, {
            'Cache-Control': 'public, max-age=300',
            'Access-Control-Allow-Origin': '*',
        });
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
        language: 'zh-CN',
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
        limit: 50,
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
            hashtags: { columns: {}, with: { hashtag: { columns: { name: true } } } },
        },
    };

    const feed_list = (await db.query.feeds.findMany(queryConfig as any)) as any[];
    const feed = new Feed(feedConfig);

    for (const f of feed_list) {
        let contentHtml = '';
        if (f.content) {
            // Use lightweight markdown-to-HTML instead of heavy unified/remark/rehype pipeline
            contentHtml = mdToHtml(f.content);
        }

        const itemPath = f.alias ? `/${f.alias}` : `/feed/${f.id}`;
        const absoluteLink = baseUrl ? `${baseUrl}${itemPath}` : itemPath;

        feed.addItem({
            title: f.title || "No title",
            id: absoluteLink,
            link: absoluteLink, 
            date: f.createdAt,
            description: f.summary || mdToPlainText(f.content || "").slice(0, 200),
            content: contentHtml,
            author: f.user ? [{ name: f.user.username }] : undefined,
            category: (f as any).hashtags?.map((h: any) => ({ name: h.hashtag.name })) || undefined,
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
