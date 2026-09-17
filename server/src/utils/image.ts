export function stripImageMetadataFromUrl(url?: string | null) {
    if (!url) {
        return undefined;
    }

    return url.split("#", 2)[0];
}

export function parseImageMetadataFromUrl(url?: string | null) {
    if (!url) {
        return {
            src: undefined,
            blurhash: undefined,
            width: undefined,
            height: undefined,
            thumb: undefined,
        };
    }

    const [src, fragment = ""] = url.split("#", 2);
    const params = new URLSearchParams(fragment);
    const width = params.get("width");
    const height = params.get("height");

    return {
        src,
        blurhash: params.get("blurhash") || undefined,
        width: width ? Number.parseInt(width, 10) : undefined,
        height: height ? Number.parseInt(height, 10) : undefined,
        thumb: params.get("thumb") || undefined,
    };
}

export function listMarkdownImageUrls(content: string) {
    const imagePattern = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/g;
    const matches: string[] = [];

    for (const match of content.matchAll(imagePattern)) {
        if (match[1]) {
            matches.push(match[1]);
        }
    }

    return matches;
}

export function listHtmlImageUrls(content: string) {
    const imagePattern = /<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi;
    const matches: string[] = [];

    for (const match of content.matchAll(imagePattern)) {
        if (match[1]) {
            matches.push(match[1]);
        }
    }

    return matches;
}

export function listContentImageUrls(content: string) {
    return [...listMarkdownImageUrls(content), ...listHtmlImageUrls(content)];
}

export function contentHasImagesMissingMetadata(content: string) {
    return listContentImageUrls(content).some((url) => {
        const metadata = parseImageMetadataFromUrl(url);
        return !metadata.blurhash || !metadata.width || !metadata.height;
    });
}

/**
 * 判断正文里是否存在「需要缩略图但还没有」的图片：
 * - 已有 #thumb= → 已补齐，不算。
 * - 尺寸已知且长边不超过缩略图上限（480）→ 原图即足够小，不需要缩略图，不算。
 * - 其余（无 thumb 且尺寸未知或长边较大）→ 算待处理。
 */
export function contentHasImagesMissingThumb(content: string) {
    const maxThumbSide = 480;
    return listContentImageUrls(content).some((url) => {
        const metadata = parseImageMetadataFromUrl(url);
        if (metadata.thumb) {
            return false;
        }
        if (metadata.width && metadata.height) {
            return Math.max(metadata.width, metadata.height) > maxThumbSide;
        }
        return true;
    });
}

export function extractImage(content: string) {
    const img_reg = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/;
    const img_match = img_reg.exec(content);
    let avatar: string | undefined = undefined;
    if (img_match) {
        avatar = stripImageMetadataFromUrl(img_match[1]);
    }
    return avatar;
}

export function extractImageWithMetadata(content: string) {
    const img_reg = /!\[.*?\]\((\S+?)(?:\s+"[^"]*")?\)/;
    const img_match = img_reg.exec(content);
    return img_match?.[1];
}
