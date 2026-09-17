import { and, eq } from "drizzle-orm";
import { Hono } from "hono";
import type { DB } from "../core/hono-types";
import { profileAsync } from "../core/server-timing";
import { feedHashtags, hashtags } from "../db/schema";
import type { AppContext } from "../core/hono-types";

export function TagService(): Hono {
    const app = new Hono();

    // GET /tag
    app.get('/', async (c: AppContext) => {
        const db = c.get('db');
        const cache = c.get('cache');

        const tag_list = await profileAsync(c, 'tag_list_cache_get', () => cache.getOrSet('tags_', async () => {
            const rows = await profileAsync(c, 'tag_list_db', () => db.query.hashtags.findMany({
                with: {
                    feeds: { columns: { feedId: true } }
                }
            }));

            return rows.map((tag: any) => ({
                ...tag,
                feeds: tag.feeds.length
            }));
        }));

        // 公开只读数据，允许边缘缓存减少 D1 压力
        c.header('Cache-Control', 'public, max-age=600');
        c.header('CDN-Cache-Control', 'public, max-age=600');
        return c.json(tag_list);
    });

    // GET /tag/:name
    app.get('/:name', async (c: AppContext) => {
        const db = c.get('db');
        const admin = c.get('admin');
        const nameDecoded = decodeURI(c.req.param('name'));
        
        const tag = await profileAsync(c, 'tag_detail_db', () => db.query.hashtags.findFirst({
            where: eq(hashtags.name, nameDecoded),
            with: {
                feeds: {
                    with: {
                        feed: {
                            columns: {
                                id: true, title: true, summary: true, content: true, 
                                createdAt: true, updatedAt: true, draft: false, listed: false
                            },
                            with: {
                                user: { columns: { id: true, username: true, avatar: true } },
                                hashtags: {
                                    columns: {},
                                    with: { hashtag: { columns: { id: true, name: true } } }
                                }
                            },
                            where: (feeds: any) => admin ? undefined : and(eq(feeds.draft, 0), eq(feeds.listed, 1))
                        } as any
                    }
                }
            }
        }));
        
        const tagFeeds = tag?.feeds.map((tagFeed: any) => {
            if (!tagFeed.feed) return null;
            return {
                ...tagFeed.feed,
                hashtags: tagFeed.feed.hashtags.map((hashtag: any) => hashtag.hashtag)
            };
        }).filter((feed: any) => feed !== null);
        
        if (!tag) {
            return c.text('Not found', 404);
        }
        
        return c.json({ ...tag, feeds: tagFeeds });
    });

    return app;
}

export async function bindTagToPost(db: DB, feedId: number, tags: string[]) {
    await db.delete(feedHashtags).where(eq(feedHashtags.feedId, feedId));
    
    for (const tag of tags) {
        const tagId = await getTagIdOrCreate(db, tag);
        await db.insert(feedHashtags).values({
            feedId: feedId,
            hashtagId: tagId
        });
    }
}

async function getTagByName(db: DB, name: string) {
    return await db.query.hashtags.findFirst({ where: eq(hashtags.name, name) });
}

async function getTagIdOrCreate(db: DB, name: string) {
    const tag = await getTagByName(db, name);
    if (tag) {
        return tag.id;
    } else {
        const result = await db.insert(hashtags).values({ name }).returning({ insertedId: hashtags.id });
        if (result.length === 0) {
            throw new Error('Failed to insert');
        } else {
            return result[0].insertedId;
        }
    }
}
