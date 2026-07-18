import { eq, and } from "drizzle-orm";
import { drizzle } from "drizzle-orm/d1";
import { getApp } from "./app-instance";

const ROOT_FEED_PATTERN = /^\/(rss\.xml|atom\.xml|rss\.json|feed\.json|feed\.xml)$/;
const APP_PUBLIC_ROUTE_PATTERN = /^\/(favicon)(?:\/|$)/;

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

async function serveInjectedSpaEntry(request: Request, env: Env): Promise<Response | null> {
  if (!env.ASSETS || !env.DB) {
    return serveSpaEntry(request, env);
  }

  const url = new URL(request.url);
  const pathname = url.pathname;

  if (SKIP_SEO_ROUTES.has(pathname)) {
    return serveSpaEntry(request, env);
  }

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
  let description = "Web3村长技术博客，专注分享AI工具实操、免费资源分享、区块链技术、自媒体运营及SEO优化经验，带你探索技术出海与变现的无限可能。";
  let structuredData: string | undefined;

  if (alias) {
    try {
      const feed = await db.query.feeds.findFirst({
        where: and(eq(schema.feeds.alias, alias), eq(schema.feeds.draft, 0), eq(schema.feeds.listed, 1)),
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
        const tags = feed.hashtags.map((h: any) => h.hashtag.name).join(", ");
        structuredData = JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Article",
          headline: feedTitle,
          description: rawDesc || description,
          datePublished: feed.createdAt,
          dateModified: feed.updatedAt,
          author: { "@type": "Person", name: feed.user?.username || siteName },
          keywords: tags,
        });
      }
    } catch {}
  }

  const modifiedHtml = injectMeta(html, title, description, structuredData);
  return new Response(modifiedHtml, {
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

  const indexResponse = await serveInjectedSpaEntry(request, env);
  if (indexResponse) {
    return indexResponse;
  }

  return new Response("Hi", { status: 200 });
}
