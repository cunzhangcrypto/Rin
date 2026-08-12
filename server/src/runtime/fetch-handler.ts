import { and, desc, eq, or } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getApp } from "./app-instance";
import { escapeHtml, markdownToHtml } from "../utils/markdown-html";
import { buildSnapshotKey } from "../utils/prerender-snapshot";
import { getStorageObject } from "../utils/storage";

const ROOT_FEED_PATTERN = /^\/(rss\.xml|atom\.xml|rss\.json|feed\.json|feed\.xml|sitemap-posts\.json)$/;
const APP_PUBLIC_ROUTE_PATTERN = /^\/(favicon)(?:\/|$)/;
const LEGACY_FEED_PATH_PATTERN = /^\/feed\/[^/]+$/;

const SKIP_SEO_ROUTES = new Set(["/login", "/callback", "/profile", "/user/github"]);

function isApiRequest(pathname: string) {
  return pathname.startsWith("/api/");
}

function rewriteApiRequest(request: Request) {
  const url = new URL(request.url);
  url.pathname = url.pathname.replace(/^\/api(?=\/|$)/, "") || "/";
  return new Request(url, request);
}

function isRootFeedRequest(pathname: string) {
  return ROOT_FEED_PATTERN.test(pathname);
}

function isAppPublicRoute(pathname: string) {
  return APP_PUBLIC_ROUTE_PATTERN.test(pathname);
}

function isStaticAssetRequest(pathname: string) {
  return /\.\w+$/.test(pathname);
}

async function tryServeAsset(request: Request, env: Env) {
  if (!env.ASSETS) {
    return null;
  }

  try {
    const asset = await env.ASSETS.fetch(request);
    if (asset.status === 200 || (asset.status >= 300 && asset.status < 400)) {
      return asset;
    }
  } catch {}

  return null;
}

async function serveSpaEntry(request: Request, env: Env) {
  if (!env.ASSETS) {
    return null;
  }

  try {
    const url = new URL(request.url);
    const indexRequest = new Request(new URL("/", url.origin), request);
    const indexResponse = await env.ASSETS.fetch(indexRequest);
    if (indexResponse.status === 200 || (indexResponse.status >= 300 && indexResponse.status < 400)) {
      return indexResponse;
    }
  } catch {}

  return null;
}

function injectMeta(html: string, title: string, description: string, structuredData?: string) {
  let result = html;

  const escapedTitle = title.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  const escapedDesc = description.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

  result = result.replace(/<title>.*?<\/title>/, `<title>${escapedTitle}</title>`);

  result = result.replace(
    /<meta name="description" content=".*?"(\s*\/?)>/,
    `<meta name="description" content="${escapedDesc}"$1>`,
  );

  if (structuredData) {
    const tag = `<script type="application/ld+json">${structuredData}</script>`;
    result = result.replace("</head>", `${tag}\n</head>`);
  }

  return result;
}

// 预渲染：把文章列表渲染为静态 HTML 卡片（标题+摘要+链接），注入 SPA 壳供 AI 抓取器读取
function renderFeedCards(
  items: { id: number; title: string; summary: string; alias: string | null }[],
): string {
  const cards = items.map((item) => {
    const href = item.alias ? `/${item.alias}` : `/feed/${item.id}`;
    return `<article class="prerender-card"><h2><a href="${escapeHtml(href)}">${escapeHtml(item.title || "")}</a></h2><p>${escapeHtml(item.summary || "")}</p></article>`;
  });
  return `<div class="prerender-list">${cards.join("")}</div>`;
}

// 预渲染：把渲染好的正文/列表 HTML 注入 <div id="root">，React 挂载时会自动替换
function injectBody(html: string, bodyHtml: string): string {
  if (!bodyHtml) {
    return html;
  }
  return html.replace('<div id="root"></div>', `<div id="root">${bodyHtml}</div>`);
}

// 旧版 /feed/:id 链接：若文章有别名，301 重定向到根路径别名，保证全站统一用别名 URL
async function tryRedirectLegacyFeedPath(request: Request, env: Env): Promise<Response | null> {
  const url = new URL(request.url);
  if (!env.DB) return null;

  const schema = await import("../db/schema");
  const db = drizzle(env.DB, { schema });
  const id = url.pathname.replace(/^\/feed\//, "");
  const id_num = parseInt(id);

  try {
    const feed = await db.query.feeds.findFirst({
      where: or(eq(schema.feeds.id, id_num), eq(schema.feeds.alias, id)),
      columns: { alias: true },
    });

    if (feed?.alias && `/${feed.alias}` !== url.pathname) {
      return Response.redirect(`${url.origin}/${feed.alias}`, 301);
    }
  } catch {}

  return null;
}

async function serveInjectedSpaEntry(request: Request, env: Env): Promise<Response | null> {
  if (!env.ASSETS || !env.DB) {
    return serveSpaEntry(request, env);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (SKIP_SEO_ROUTES.has(pathname)) {
    return serveSpaEntry(request, env);
  }

  // 优先返回预渲染快照（seo-render 生成的完整渲染 HTML，与浏览器结果一致）；
  // 未命中则回落实时直出
  try {
    if (env.R2_BUCKET || env.S3_ENDPOINT) {
      const snapshotKey = buildSnapshotKey(env, url);
      const snapshot = await getStorageObject(env, snapshotKey);
      if (snapshot) {
        return snapshot;
      }
    }
  } catch {}

  const indexResponse = await serveSpaEntry(request, env);
  if (!indexResponse) {
    return null;
  }

  const html = await indexResponse.text();
  const alias = pathname.replace(/^\//, "");
  const schema = await import("../db/schema");
  const db = drizzle(env.DB, { schema });
  const siteName = "Web3村长";

  let title = `${siteName} | AI工具、技术实操、网络媒体运营 - 探索技术出海与变现`;
  let description = "面向中文互联网用户，分享AI工具、技术实操与变现方法的技术博客";
  let structuredData: string | undefined;
  let bodyHtml = "";

  // 预渲染首页：前 10 条已发布文章卡片（标题+摘要+链接）
  if (pathname === "/") {
    try {
      const list = await db.query.feeds.findMany({
        where: and(eq(schema.feeds.draft, 0), eq(schema.feeds.listed, 1)),
        columns: { id: true, title: true, summary: true, alias: true, content: true },
        orderBy: [desc(schema.feeds.top), desc(schema.feeds.createdAt), desc(schema.feeds.updatedAt)],
        limit: 10,
      });
      bodyHtml = renderFeedCards(list.map((f: any) => ({
        id: f.id,
        title: f.title,
        alias: f.alias,
        summary: f.summary && f.summary.length > 0 ? f.summary : (f.content || "").slice(0, 100),
      })));
    } catch (error) {
      console.error("[prerender-home]", error);
    }
  } else if (pathname === "/geo") {
    // 预渲染 GEO 栏目：GEO 文章列表（标题+摘要+链接）
    try {
      const list = await db.query.feeds.findMany({
        where: and(eq(schema.feeds.draft, 0), eq(schema.feeds.ai_visible, 1)),
        columns: { id: true, title: true, summary: true, alias: true, content: true },
        orderBy: [desc(schema.feeds.createdAt), desc(schema.feeds.updatedAt)],
      });
      bodyHtml = renderFeedCards(list.map((f: any) => ({
        id: f.id,
        title: f.title,
        alias: f.alias,
        summary: f.summary && f.summary.length > 0 ? f.summary : (f.content || "").slice(0, 100),
      })));
    } catch (error) {
      console.error("[prerender-geo]", error);
    }
  }

  if (alias) {
    try {
      const feed = await db.query.feeds.findFirst({
        where: and(eq(schema.feeds.alias, alias), eq(schema.feeds.draft, 0), or(eq(schema.feeds.listed, 1), eq(schema.feeds.ai_visible, 1))),
        columns: { id: true, title: true, content: true, summary: true, createdAt: true, updatedAt: true },
        with: {
          user: { columns: { username: true } },
          hashtags: { columns: {}, with: { hashtag: { columns: { name: true } } } },
        },
      });

      if (feed) {
        const feedTitle = feed.title || "未命名";
        const rawDesc = feed.summary || (feed.content ? feed.content.substring(0, 200) : "");
        title = `${feedTitle} - ${siteName}`;
        if (rawDesc) description = rawDesc;
        const tags = feed.hashtags.map((h: any) => h.hashtag.name);
        const firstTag = tags.length > 0 ? tags[0] : "";
        const feedUrl = `https://www.cunzhangblog.com/${alias}`;

        // Extract first image from markdown content
        let feedImage = "";
        const imgMatch = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/.exec(feed.content || "");
        if (imgMatch) {
          const rawUrl = imgMatch[1].split("#")[0];
          feedImage = rawUrl.startsWith("http") ? rawUrl : `https://www.cunzhangblog.com${rawUrl.startsWith("/") ? "" : "/"}${rawUrl}`;
        }

        structuredData = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "BlogPosting",
          "@id": `${feedUrl}#article`,
          url: feedUrl,
          headline: feedTitle,
          description: rawDesc || description,
          image: [feedImage || "https://www.cunzhangblog.com/logo.png"],
          datePublished: feed.createdAt,
          dateModified: feed.updatedAt,
          author: { "@id": "https://www.cunzhangblog.com/#person" },
          publisher: { "@id": "https://www.cunzhangblog.com/#organization" },
          mainEntityOfPage: {
            "@type": "WebPage",
            "@id": feedUrl,
          },
          articleSection: firstTag,
          wordCount: (feed.content || "").length,
          keywords: tags,
        });

        // 预渲染文章正文（markdown → HTML）
        if (feed.content) {
          try {
            bodyHtml = `<article class="prerender-article">${await markdownToHtml(feed.content)}</article>`;
          } catch (error) {
            console.error("[prerender-article]", error);
          }
        }
      }
    } catch (error) {
      console.error("[prerender-alias]", error);
    }
  }

  const modifiedHtml = injectMeta(html, title, description, structuredData);
  const finalHtml = injectBody(modifiedHtml, bodyHtml);
  return new Response(finalHtml, {
    status: indexResponse.status,
    statusText: indexResponse.statusText,
    headers: indexResponse.headers,
  });
}

export async function handleFetch(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;

  if (isRootFeedRequest(pathname)) {
    return getApp().fetch(request, env);
  }

  if (isApiRequest(pathname)) {
    return getApp().fetch(rewriteApiRequest(request), env);
  }

  if (isAppPublicRoute(pathname)) {
    return getApp().fetch(request, env);
  }

  if (isStaticAssetRequest(pathname)) {
    const asset = await tryServeAsset(request, env);
    if (asset) {
      return asset;
    }
  }

  // 旧版 /feed/:id（数字或别名）链接：有别名则 301 到根路径别名
  if (LEGACY_FEED_PATH_PATTERN.test(pathname)) {
    const legacyRedirect = await tryRedirectLegacyFeedPath(request, env);
    if (legacyRedirect) {
      return legacyRedirect;
    }
  }

  const indexResponse = await serveInjectedSpaEntry(request, env);
  if (indexResponse) {
    return indexResponse;
  }

  return new Response("Hi", { status: 200 });
}
