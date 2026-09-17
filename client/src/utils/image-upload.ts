import { client } from "../app/runtime";
import { encodeBlurhash } from "./blurhash";

export const DEFAULT_IMAGE_MAX_FILE_SIZE = 5 * 1024 * 1024;

export type UploadedImageResult = {
  url: string;
  blurhash?: string;
  width?: number;
  height?: number;
  /** 首页卡片使用的缩略图 URL（约 480px 宽 WebP），详情页仍用原图 */
  thumb?: string;
};

type ImageMetadata = {
  blurhash?: string;
  width?: number;
  height?: number;
  thumb?: string;
};

type MarkdownImageMetadataResult = {
  content: string;
  updated: number;
  failed: number;
};

export function isImageFile(file: File) {
  return file.type.startsWith("image/");
}

function toPositiveInteger(value?: string | null) {
  if (!value) {
    return undefined;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

export function attachImageMetadataToUrl(url: string, metadata: ImageMetadata = {}) {
  const { blurhash, width, height, thumb } = metadata;
  if (!blurhash && !width && !height && !thumb) {
    return url;
  }

  const [baseUrl, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);
  if (blurhash) {
    params.set("blurhash", blurhash);
  }
  if (width) {
    params.set("width", String(width));
  }
  if (height) {
    params.set("height", String(height));
  }
  if (thumb) {
    params.set("thumb", thumb);
  }
  return `${baseUrl}#${params.toString()}`;
}

export function parseImageUrlMetadata(url?: string | null) {
  if (!url) {
    return {
      src: "",
      blurhash: undefined as string | undefined,
      thumb: undefined as string | undefined,
    };
  }

  const [src, fragment = ""] = url.split("#", 2);
  const params = new URLSearchParams(fragment);

  return {
    src,
    blurhash: params.get("blurhash") || undefined,
    thumb: params.get("thumb") || undefined,
    width: toPositiveInteger(params.get("width")),
    height: toPositiveInteger(params.get("height")),
  };
}

export function stripImageUrlMetadata(url?: string | null) {
  return parseImageUrlMetadata(url).src;
}

export function buildMarkdownImage(fileName: string, url: string, metadata: ImageMetadata = {}) {
  const safeAlt = fileName.replace(/[[\]]/g, "");
  const safeUrl = url.replace(/\s/g, "%20");
  return `![${safeAlt}](${attachImageMetadataToUrl(safeUrl, metadata)})\n`;
}

async function loadImage(file: File) {
  const objectUrl = URL.createObjectURL(file);

  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image();
      element.onload = () => resolve(element);
      element.onerror = () => reject(new Error("Failed to load image"));
      element.src = objectUrl;
    });
    return image;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadImageFromUrl(url: string) {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.crossOrigin = "anonymous";
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error(`Failed to load image: ${url}`));
    element.src = url;
  });
  return image;
}

export async function generateImageMetadata(file: File) {
  if (!isImageFile(file)) {
    return {};
  }

  const image = await loadImage(file);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return {};
  }

  const scale = Math.min(1, 48 / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {};
  }

  context.drawImage(image, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  return {
    blurhash: encodeBlurhash(imageData.data, width, height, 4, 3),
    width: image.naturalWidth,
    height: image.naturalHeight,
  };
}

export async function generateImageMetadataFromUrl(url: string): Promise<ImageMetadata> {
  const { src, blurhash, width, height } = parseImageUrlMetadata(url);
  if (blurhash && width && height) {
    return { blurhash, width, height };
  }

  const image = await loadImageFromUrl(src);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return {
      blurhash,
      width: width || undefined,
      height: height || undefined,
    };
  }

  const scale = Math.min(1, 48 / longestSide);
  const canvas = document.createElement("canvas");
  const canvasWidth = Math.max(1, Math.round(image.naturalWidth * scale));
  const canvasHeight = Math.max(1, Math.round(image.naturalHeight * scale));
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return {
      blurhash,
      width: width || image.naturalWidth || undefined,
      height: height || image.naturalHeight || undefined,
    };
  }

  context.drawImage(image, 0, 0, canvasWidth, canvasHeight);
  const imageData = context.getImageData(0, 0, canvasWidth, canvasHeight);

  return {
    blurhash: blurhash || encodeBlurhash(imageData.data, canvasWidth, canvasHeight, 4, 3),
    width: width || image.naturalWidth || undefined,
    height: height || image.naturalHeight || undefined,
  };
}

export async function enrichMarkdownImageMetadata(content: string): Promise<MarkdownImageMetadataResult> {
  const markdownPattern = /!\[(.*?)\]\((\S+?)(?:\s+"[^"]*")?\)/g;
  const htmlPattern = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi;
  const markdownMatches = [...content.matchAll(markdownPattern)].map((match) => ({
    type: "markdown" as const,
    fullMatch: match[0],
    alt: match[1] || "",
    rawUrl: match[2],
  }));
  const htmlMatches = [...content.matchAll(htmlPattern)].map((match) => ({
    type: "html" as const,
    fullMatch: match[0],
    beforeSrc: match[1] || "",
    rawUrl: match[2],
    afterSrc: match[3] || "",
  }));
  const matches = [...markdownMatches, ...htmlMatches];

  if (matches.length === 0) {
    return { content, updated: 0, failed: 0 };
  }

  let nextContent = content;
  let updated = 0;
  let failed = 0;

  for (const match of matches) {
    const { fullMatch, rawUrl } = match;
    if (!fullMatch || !rawUrl) {
      continue;
    }

    const existing = parseImageUrlMetadata(rawUrl);
    if (existing.blurhash && existing.width && existing.height) {
      continue;
    }

    try {
      const metadata = await generateImageMetadataFromUrl(rawUrl);
      if (!metadata.blurhash || !metadata.width || !metadata.height) {
        failed += 1;
        continue;
      }

      // 保留已有的 thumb，避免在后续补齐过程中被覆盖
      const nextUrl = attachImageMetadataToUrl(existing.src, {
        ...metadata,
        thumb: existing.thumb || metadata.thumb,
      });
      const replacement = match.type === "markdown"
        ? `![${match.alt}](${nextUrl})`
        : `<img${match.beforeSrc}src="${nextUrl}"${match.afterSrc}>`;
      if (replacement !== fullMatch) {
        nextContent = nextContent.replace(fullMatch, replacement);
        updated += 1;
      }
    } catch {
      failed += 1;
    }
  }

  return {
    content: nextContent,
    updated,
    failed,
  };
}

/**
 * 将图片文件在前端转换为 WebP 格式（大幅减小体积，节省 R2 存储与流量）。
 * - GIF 保留原样（动图转换会丢失动画）。
 * - 转换失败或浏览器不支持 WebP 编码时返回原文件，不阻塞上传。
 */
async function toWebpFile(file: File): Promise<File> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) {
    return file;
  }
  try {
    if (typeof createImageBitmap === "undefined") {
      return file;
    }
    const bitmap = await createImageBitmap(file);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return file;
    }
    context.drawImage(bitmap, 0, 0);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.82),
    );
    if (!blob) {
      return file;
    }
    const baseName = file.name.replace(/\.[^/.]+$/, "");
    return new File([blob], `${baseName}.webp`, { type: "image/webp" });
  } catch {
    return file;
  }
}

/**
 * 将任意字符串转为 URL-safe 的 slug（用于图片文件名，进 markdown 的 alt）。
 */
export function slugify(value: string): string {
  const latin = value
    .toLowerCase()
    .replace(/[\s_-]+/g, "-")
    .replace(/[^\w\u4e00-\u9fa5-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  if (latin) {
    return latin;
  }
  // 全中文标题时转拼音会引入额外依赖，这里用「image」兜底
  return "image";
}

/**
 * 生成缩略图 WebP（长边约 480px），供首页卡片使用，避免加载原图。
 * - GIF/非图片/浏览器不支持/原图已较小 时返回 null（降级为首页用原图）。
 * - 不改变上传主文件的逻辑，缩略图失败不影响上传。
 */
async function createThumbnailFile(file: File, thumbName: string, maxSide = 480): Promise<File | null> {
  if (file.type === "image/gif" || !file.type.startsWith("image/")) {
    return null;
  }
  try {
    if (typeof createImageBitmap === "undefined") {
      return null;
    }
    const bitmap = await createImageBitmap(file);
    const longestSide = Math.max(bitmap.width, bitmap.height);
    if (!longestSide || longestSide <= maxSide) {
      bitmap.close();
      return null;
    }
    const scale = Math.min(1, maxSide / longestSide);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      bitmap.close();
      return null;
    }
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", 0.8),
    );
    if (!blob) {
      return null;
    }
    return new File([blob], thumbName, { type: "image/webp" });
  } catch {
    return null;
  }
}

export interface UploadImageOptions {
  /** 文章标题，用于生成描述性的图片文件名（同时成为 markdown 的 alt 文本） */
  title?: string;
  /** 是否在前端自动转换为 WebP（默认开启；头像/OG 图等希望保留原格式的场景可关闭） */
  convertToWebp?: boolean;
}

export async function uploadImageFile(file: File, options?: UploadImageOptions): Promise<UploadedImageResult> {
  const webpFile = options?.convertToWebp === false ? file : await toWebpFile(file);
  // 有标题时用标题 slug 作为文件名（会成为 alt 文本，利于 SEO/GEO）
  const fileName = options?.title ? `${slugify(options.title)}.${webpFile.name.split(".").pop()}` : webpFile.name;
  const baseName = fileName.replace(/\.[^/.]+$/, "");
  const thumbFileName = `${baseName}-thumb.webp`;

  const [uploadResult, metadataResult, thumbResult] = await Promise.allSettled([
    client.storage.upload(webpFile, fileName),
    generateImageMetadata(file),
    createThumbnailFile(webpFile, thumbFileName).then(async (thumbFile) => {
      if (!thumbFile) {
        return null;
      }
      const res = await client.storage.upload(thumbFile, thumbFileName);
      if (res.error) {
        return null;
      }
      return typeof res.data === "string" ? res.data : res.data?.url;
    }),
  ]);

  if (uploadResult.status === "rejected") {
    throw uploadResult.reason instanceof Error
      ? uploadResult.reason
      : new Error("Upload failed");
  }

  const { data, error } = uploadResult.value;
  if (error) {
    throw new Error(error.value);
  }

  const url =
    typeof data === "string"
      ? data
      : data?.url;

  if (!url) {
    throw new Error("Invalid upload response");
  }

  const thumbUrl = thumbResult.status === "fulfilled" ? thumbResult.value : undefined;

  return {
    url,
    ...(thumbUrl ? { thumb: thumbUrl } : {}),
    ...(metadataResult.status === "fulfilled" ? metadataResult.value : {}),
  };
}

const THUMB_MAX_SIDE = 480;

/**
 * 为单张图片解析出缩略图：
 * - "small"：原图长边不超过缩略图上限，无需缩略图（用原图 URL 标记已处理）。
 * - { thumbUrl }：已生成并上传到 R2 的缩略图 WebP URL。
 * - null：无法在此刻确定（应保持原样，待下次重试）。
 */
async function resolveThumbUrlForImage(rawUrl: string): Promise<{ thumbUrl: string } | "small" | null> {
  const existing = parseImageUrlMetadata(rawUrl);
  if (existing.thumb) {
    return null;
  }
  if (existing.width && existing.height && Math.max(existing.width, existing.height) <= THUMB_MAX_SIDE) {
    return "small";
  }

  const image = await loadImageFromUrl(existing.src);
  const longestSide = Math.max(image.naturalWidth, image.naturalHeight);
  if (!longestSide) {
    return null;
  }
  if (longestSide <= THUMB_MAX_SIDE) {
    return "small";
  }

  const scale = Math.min(1, THUMB_MAX_SIDE / longestSide);
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    return null;
  }
  context.drawImage(image, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.8));
  if (!blob) {
    return null;
  }

  const srcBase = decodeURIComponent((existing.src.split("/").pop() || "image").replace(/\?.*$/, "")).replace(/\.[^/.]+$/, "");
  const thumbName = `${srcBase || "image"}-thumb.webp`;
  const res = await client.storage.upload(new File([blob], thumbName, { type: "image/webp" }), thumbName);
  if (res.error) {
    return null;
  }
  const url = typeof res.data === "string" ? res.data : res.data?.url;
  if (!url) {
    return null;
  }
  return { thumbUrl: url };
}

/**
 * 批量补齐 markdown 正文里缺失的缩略图（#thumb=）：
 * - 遍历 markdown 图片与 <img>，为无 thumb 的图片在浏览器里生成约 480px 的 WebP 并上传回 R2，
 *   再把 thumb URL 拼进原图地址的 fragment，换出更新后的正文。
 * - 原图已足够小的图片直接以原图 URL 标记为已处理，避免每次重复扫描。
 */
export async function thumbnailizeMarkdownImageMetadata(content: string): Promise<MarkdownImageMetadataResult> {
  const markdownPattern = /!\[(.*?)\]\((\S+?)(?:\s+"[^"]*")?\)/g;
  const htmlPattern = /<img\b([^>]*?)\bsrc=["']([^"']+)["']([^>]*?)>/gi;
  const markdownMatches = [...content.matchAll(markdownPattern)].map((match) => ({
    type: "markdown" as const,
    fullMatch: match[0],
    alt: match[1] || "",
    rawUrl: match[2],
  }));
  const htmlMatches = [...content.matchAll(htmlPattern)].map((match) => ({
    type: "html" as const,
    fullMatch: match[0],
    beforeSrc: match[1] || "",
    rawUrl: match[2],
    afterSrc: match[3] || "",
  }));
  const matches = [...markdownMatches, ...htmlMatches];

  if (matches.length === 0) {
    return { content, updated: 0, failed: 0 };
  }

  let nextContent = content;
  let updated = 0;
  let failed = 0;

  for (const match of matches) {
    const { fullMatch, rawUrl } = match;
    if (!fullMatch || !rawUrl) {
      continue;
    }

    const existing = parseImageUrlMetadata(rawUrl);
    if (existing.thumb) {
      continue;
    }

    let thumbUrl: string | undefined;
    try {
      const outcome = await resolveThumbUrlForImage(rawUrl);
      if (outcome === "small") {
        thumbUrl = existing.src;
      } else if (outcome) {
        thumbUrl = outcome.thumbUrl;
      }
    } catch {
      failed += 1;
      continue;
    }

    if (!thumbUrl) {
      failed += 1;
      continue;
    }

    const nextUrl = attachImageMetadataToUrl(existing.src, { thumb: thumbUrl });
    const replacement = match.type === "markdown"
      ? `![${match.alt}](${nextUrl})`
      : `<img${match.beforeSrc}src="${nextUrl}"${match.afterSrc}>`;
    if (replacement !== fullMatch) {
      nextContent = nextContent.replace(fullMatch, replacement);
      updated += 1;
    }
  }

  return {
    content: nextContent,
    updated,
    failed,
  };
}
