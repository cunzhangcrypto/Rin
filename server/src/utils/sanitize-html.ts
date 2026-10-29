// 广告 HTML 白名单净化器（纯 TS，可在 bun:test 中单测）
// 只保留安全的标签、行内 CSS 与链接，禁止 script / 事件属性 / javascript: 等
// 保存广告时执行一次，结果写入 html_sanitized，前台只渲染净化后的内容。

const ALLOWED_TAGS = new Set([
  "div", "span", "a", "p", "ul", "ol", "li", "strong", "b", "em", "i", "small",
  "img", "br", "h1", "h2", "h3", "h4",
]);

const VOID_TAGS = new Set(["img", "br"]);

const BASE_ATTRS = new Set(["style", "title"]);

const TAG_ATTRS: Record<string, Set<string>> = {
  a: new Set(["href", "target"]),
  img: new Set(["src", "alt", "width", "height", "loading"]),
};

const ALLOWED_CSS_PROPS = new Set([
  "color", "background", "background-color", "background-image", "background-size",
  "background-position", "background-repeat",
  "border", "border-top", "border-right", "border-bottom", "border-left",
  "border-color", "border-width", "border-style", "border-radius",
  "padding", "padding-top", "padding-right", "padding-bottom", "padding-left",
  "margin", "margin-top", "margin-right", "margin-bottom", "margin-left",
  "font", "font-size", "font-weight", "font-family", "font-style",
  "line-height", "letter-spacing", "text-align", "text-decoration", "text-transform",
  "display", "flex", "flex-direction", "flex-wrap", "flex-grow", "flex-shrink",
  "flex-basis", "justify-content", "align-items", "align-self", "gap", "row-gap",
  "column-gap", "width", "height", "min-width", "min-height", "max-width",
  "max-height", "object-fit", "object-position", "overflow", "overflow-x",
  "overflow-y", "white-space", "word-break", "word-wrap", "box-shadow", "opacity",
  "vertical-align", "list-style", "list-style-type",
]);

const BLOCKED_VALUE = /expression|javascript:|vbscript:|behavior:|@import|<\/|<\s*script/i;

const SAFE_LINK_PROTOCOL = /^(https?:|mailto:|\/|\.{1,2}\/|#)/i;

export const MAX_AD_HTML_LENGTH = 200_000;

function escapeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export function isSafeUrl(value: string): boolean {
  const url = value.trim();
  if (!url) return false;
  if (BLOCKED_VALUE.test(url)) return false;
  return SAFE_LINK_PROTOCOL.test(url);
}

function sanitizeStyle(raw: string): string {
  const declarations: string[] = [];
  for (const part of raw.split(";")) {
    const index = part.indexOf(":");
    if (index < 0) continue;
    const prop = part.slice(0, index).trim().toLowerCase();
    let value = part.slice(index + 1).trim();
    if (!prop || !value) continue;
    if (!ALLOWED_CSS_PROPS.has(prop)) continue;
    value = value.replace(/!important/gi, "").trim();
    if (!value || BLOCKED_VALUE.test(value)) continue;
    // 禁止定位类属性，避免广告浮层覆盖正文或导航
    if (prop.startsWith("position") || prop === "z-index" || prop === "top" || prop === "left" || prop === "right" || prop === "bottom") continue;
    if (/url\s*\(/i.test(value)) {
      const urls = Array.from(value.matchAll(/url\s*\(\s*(['"]?)(.*?)\1\s*\)/gi)).map((match) => match[2].trim());
      if (urls.length === 0 || urls.some((url) => !SAFE_LINK_PROTOCOL.test(url))) continue;
    }
    declarations.push(`${prop}: ${value}`);
  }
  return declarations.join("; ");
}

function sanitizeAttributes(tag: string, attrs: Record<string, string | true>): string {
  const output: string[] = [];
  const allowed = new Set([...BASE_ATTRS, ...(TAG_ATTRS[tag] ?? [])]);

  for (const [rawName, rawValue] of Object.entries(attrs)) {
    const name = rawName.toLowerCase();
    if (name.startsWith("on")) continue;
    if (!allowed.has(name)) continue;
    const value = rawValue === true ? "" : rawValue;

    if (name === "style") {
      const style = sanitizeStyle(value);
      if (style) output.push(`style="${escapeAttr(style)}"`);
      continue;
    }

    if (name === "href" || name === "src") {
      const url = value.trim();
      if (!isSafeUrl(url)) continue;
      output.push(`${name}="${escapeAttr(url)}"`);
      continue;
    }

    if (name === "target") {
      if (value.trim() === "_blank") output.push('target="_blank"');
      continue;
    }

    if (name === "width" || name === "height") {
      if (!/^\d{1,4}(px|%)?$/i.test(value.trim())) continue;
      output.push(`${name}="${escapeAttr(value.trim())}"`);
      continue;
    }

    if (name === "loading") {
      const mode = value.trim().toLowerCase();
      if (mode !== "lazy" && mode !== "eager") continue;
      output.push(`loading="${mode}"`);
      continue;
    }

    if (name === "title" || name === "alt") {
      output.push(`${name}="${escapeAttr(value.slice(0, 200))}"`);
    }
  }

  if (tag === "a" && output.some((item) => item.startsWith("href="))) {
    const hasTarget = output.some((item) => item === 'target="_blank"');
    if (!hasTarget) output.push('target="_blank"');
    output.push('rel="nofollow sponsored noopener noreferrer"');
  }

  return output.length > 0 ? ` ${output.join(" ")}` : "";
}

function findTagEnd(html: string, start: number): number {
  let quote = "";
  for (let i = start; i < html.length; i += 1) {
    const char = html[i];
    if (quote) {
      if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }
    if (char === ">") return i;
  }
  return -1;
}

function parseAttributes(raw: string): Record<string, string | true> {
  const attrs: Record<string, string | true> = {};
  const pattern = /([a-zA-Z_][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(raw)) !== null) {
    const name = match[1].toLowerCase();
    const value = match[2] ?? match[3] ?? match[4];
    attrs[name] = value === undefined ? true : value;
  }
  return attrs;
}

function skipRawContent(html: string, from: number, tag: string): number {
  const lower = html.toLowerCase();
  const closing = `</${tag}`;
  const index = lower.indexOf(closing, from);
  if (index < 0) return html.length;
  const end = findTagEnd(html, index);
  return end < 0 ? html.length : end + 1;
}

export function sanitizeAdHtml(input: string): string {
  if (!input) return "";
  if (input.length > MAX_AD_HTML_LENGTH) return "";

  const html = input;
  const output: string[] = [];
  const stack: string[] = [];
  let cursor = 0;

  while (cursor < html.length) {
    const next = html.indexOf("<", cursor);
    if (next < 0) {
      output.push(escapeText(html.slice(cursor)));
      break;
    }
    if (next > cursor) {
      output.push(escapeText(html.slice(cursor, next)));
    }

    if (html.startsWith("<!--", next)) {
      const commentEnd = html.indexOf("-->", next + 4);
      cursor = commentEnd < 0 ? html.length : commentEnd + 3;
      continue;
    }

    if (html.startsWith("<!", next) || html.startsWith("<?", next)) {
      const end = findTagEnd(html, next);
      cursor = end < 0 ? html.length : end + 1;
      continue;
    }

    const tagEnd = findTagEnd(html, next + 1);
    if (tagEnd < 0) {
      output.push(escapeText(html.slice(next)));
      break;
    }

    const inner = html.slice(next + 1, tagEnd).trim();
    cursor = tagEnd + 1;

    if (!inner) continue;

    const isClosing = inner.startsWith("/");
    const body = isClosing ? inner.slice(1).trim() : inner;
    const selfClosing = body.endsWith("/");
    const nameMatch = /^([a-zA-Z][a-zA-Z0-9-]*)/.exec(body);
    const tag = nameMatch ? nameMatch[1].toLowerCase() : "";
    if (!tag) continue;

    if (!isClosing && (tag === "script" || tag === "style")) {
      cursor = skipRawContent(html, cursor, tag);
      continue;
    }

    if (!ALLOWED_TAGS.has(tag)) {
      // 不允许的容器标签：丢弃标签本身，保留内部文本
      continue;
    }

    if (isClosing) {
      const index = stack.lastIndexOf(tag);
      if (index >= 0) {
        while (stack.length > index) {
          const open = stack.pop();
          if (open) output.push(`</${open}>`);
        }
      }
      continue;
    }

    const attrText = nameMatch ? body.slice(nameMatch[1].length).trim() : "";
    const attrs = parseAttributes(attrText);
    output.push(`<${tag}${sanitizeAttributes(tag, attrs)}>`);
    if (!VOID_TAGS.has(tag) && !selfClosing) {
      stack.push(tag);
    }
  }

  while (stack.length > 0) {
    const open = stack.pop();
    if (open) output.push(`</${open}>`);
  }

  return output.join("").trim();
}
