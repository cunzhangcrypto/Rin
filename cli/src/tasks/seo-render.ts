import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import path from "node:path";
import { unlink } from "node:fs/promises";
import puppeteer from "puppeteer";
import { $ } from "bun";

export async function runSeoRender() {
  const env = process.env;
  const baseUrl = env.SEO_BASE_URL || "";
  const containsKey = env.SEO_CONTAINS_KEY || "";
  const folder = env.S3_CACHE_FOLDER || "cache/";

  // S3 模式：S3 兼容凭证齐全
  const region = env.S3_REGION;
  const endpoint = env.S3_ENDPOINT;
  const accessKeyId = env.S3_ACCESS_KEY_ID;
  const secretAccessKey = env.S3_SECRET_ACCESS_KEY;
  const bucket = env.S3_BUCKET;
  const accessHost = env.S3_ACCESS_HOST || endpoint;

  // R2 模式：复用 Cloudflare API Token，经 wrangler r2 object put 上传（无需 S3 兼容凭证）
  const r2BucketName = env.R2_BUCKET_NAME || "";
  const cloudflareToken = env.CLOUDFLARE_API_TOKEN || "";
  const accountId = env.CLOUDFLARE_ACCOUNT_ID || "";
  const useR2Mode = Boolean(r2BucketName && cloudflareToken && accountId) && !accessKeyId;
  const useS3Mode = Boolean(region && endpoint && accessKeyId && secretAccessKey && bucket);

  if (!baseUrl) {
    throw new Error("SEO render env is incomplete: SEO_BASE_URL is required");
  }
  if (!useS3Mode && !useR2Mode) {
    throw new Error(
      "SEO render env is incomplete: configure S3_* credentials or R2_BUCKET_NAME + CLOUDFLARE_API_TOKEN + CLOUDFLARE_ACCOUNT_ID",
    );
  }

  let s3: S3Client | null = null;
  if (useS3Mode) {
    s3 = new S3Client({
      region: region!,
      endpoint: endpoint!,
      forcePathStyle: env.S3_FORCE_PATH_STYLE === "true",
      credentials: { accessKeyId: accessKeyId!, secretAccessKey: secretAccessKey! },
    });
  }

  async function saveFile(filename: string, data: string) {
    const url = new URL(filename);
    let fileName = path.join(folder, url.pathname + url.search.replace("?", "&"));
    if (fileName.endsWith("/")) fileName += "index.html";

    if (useR2Mode) {
      const tmpFile = `.seo-render-tmp-${Date.now()}.html`;
      await Bun.write(tmpFile, data);
      try {
        await $`${process.execPath} x wrangler r2 object put ${r2BucketName}/${fileName} --file=${tmpFile} --content-type=text/html`.quiet();
      } finally {
        await unlink(tmpFile).catch(() => {});
      }
      console.info(`Saved R2:${fileName}.`);
    } else {
      await s3!.send(new PutObjectCommand({ Bucket: bucket, Key: fileName, Body: data, ContentType: "text/html" }));
      console.info(`Saved ${accessHost}/${fileName}.`);
    }
  }

  // 与 robots.txt Disallow 一致：非关键页不做预渲染快照（仅爬首页、文章页、列表分页、/geo、工具页、/about 等关键路由）
  const EXCLUDED_PATHS = ["/timeline", "/moments", "/hashtags", "/hashtag/", "/friends"];

  const fetchedLinks = new Set<string>();
  const browser = await puppeteer.launch({ args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  const ua = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36";

  function shouldCrawl(urlString: string): boolean {
    try {
      const u = new URL(urlString);
      if (u.pathname.startsWith("/api/")) return false;
      if (/\.(xml|json|txt|css|js|png|jpe?g|gif|webp|svg|ico|webmanifest|mp4|zip|pdf)$/i.test(u.pathname)) return false;
      if (EXCLUDED_PATHS.some((prefix) => u.pathname.startsWith(prefix))) return false;
    } catch {
      return false;
    }
    return true;
  }

  // 广度优先队列 + 并发 worker，替代原深度优先串行爬取
  const queue: string[] = [baseUrl];
  const concurrency = Number(process.env.SEO_CONCURRENCY || "4");

  async function crawl(url: string): Promise<void> {
    const page = await browser.newPage();
    await page.setUserAgent(ua);
    try {
      const response = await page.goto(url, { waitUntil: "networkidle2", timeout: 60000 });
      if (!response) return;
      if (response.ok() && response.headers()["content-type"]?.includes("text/html")) {
        await saveFile(url, await page.content());
        const links = await page.evaluate(() => Array.from(document.querySelectorAll("a")).map((anchor) => anchor.href));
        for (const link of links.filter((candidate) => candidate.startsWith(baseUrl) || (containsKey && candidate.includes(containsKey)))) {
          const next = link.split("#")[0];
          if (!fetchedLinks.has(next) && shouldCrawl(next)) {
            fetchedLinks.add(next);
            queue.push(next);
          }
        }
      }
    } catch (error) {
      // 单页失败不中断整站爬取
      console.warn(`Skip ${url}:`, error instanceof Error ? error.message : error);
    } finally {
      await page.close();
    }
  }

  async function worker() {
    while (queue.length > 0) {
      const url = queue.shift()!;
      if (fetchedLinks.has(url)) continue;
      fetchedLinks.add(url);
      await crawl(url);
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  await browser.close();
}
