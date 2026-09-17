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
 * 判断正文里是否存在「缩略图尚未补齐」的图片。
 * 补齐完成标准：同一张图的 fragment 需同时具备 thumb 与 width/height；
 * 缺任一（例如只有 #thumb= 但没有尺寸）都算待处理，重跑即可修复。
 * 这里不再用「长边是否超过 480」判断：补齐后小图也会写入 width/height 与
 * 自身 thumb 标记，统一以「thumb + 宽高齐全」作为完成标准。
 */
export function contentHasImagesMissingThumb(content: string) {
    return listContentImageUrls(content).some((url) => {
        const metadata = parseImageMetadataFromUrl(url);
        if (metadata.thumb && metadata.width && metadata.height) {
            return false;
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
