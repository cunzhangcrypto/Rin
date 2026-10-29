import { describe, expect, it } from "bun:test";
import { MAX_AD_HTML_LENGTH, sanitizeAdHtml } from "../sanitize-html";

describe("sanitizeAdHtml", () => {
  it("保留广告卡片允许的标签与行内样式", () => {
    const html = '<div style="display:flex;gap:8px;border-radius:12px;"><span style="color:#0f766e;">Hello</span><img src="/ad.webp" alt="ad" loading="lazy" /></div>';
    const result = sanitizeAdHtml(html);
    expect(result).toContain("display: flex");
    expect(result).toContain("gap: 8px");
    expect(result).toContain("border-radius: 12px");
    expect(result).toContain('src="/ad.webp"');
    expect(result).toContain('loading="lazy"');
    expect(result).toContain("</div>");
  });

  it("强制给链接加上 nofollow/sponsored/noopener", () => {
    const result = sanitizeAdHtml('<a href="https://example.com/?aff=1">go</a>');
    expect(result).toContain('rel="nofollow sponsored noopener noreferrer"');
    expect(result).toContain('target="_blank"');
    expect(result).toContain("https://example.com/?aff=1");
  });

  it("移除 script/style 及其内容", () => {
    const result = sanitizeAdHtml('<div>safe</div><script>alert(1)</script><style>body{display:none}</style>');
    expect(result).toBe("<div>safe</div>");
  });

  it("移除事件属性与 javascript: 链接", () => {
    const result = sanitizeAdHtml('<div onclick="alert(1)">x</div><a href="javascript:alert(1)">bad</a>');
    expect(result).not.toContain("onclick");
    expect(result).not.toContain("javascript:");
    expect(result).toBe("<div>x</div><a>bad</a>");
  });

  it("移除危险 CSS（定位、表达式、@import、data URL）", () => {
    const result = sanitizeAdHtml(
      '<div style="position:fixed;top:0;z-index:9999;background:url(data:image/png;base64,xxx);width:100%;">x</div>',
    );
    expect(result).not.toContain("position");
    expect(result).not.toContain("z-index");
    expect(result).not.toContain("data:");
    expect(result).toContain("width: 100%");
  });

  it("移除不安全图片地址并保留站内路径", () => {
    const result = sanitizeAdHtml('<img src="javascript:alert(1)" /><img src="/ok.webp" />');
    expect(result).not.toContain("javascript:");
    expect(result).toContain('src="/ok.webp"');
  });

  it("自动闭合未闭合标签，避免样式泄漏", () => {
    const result = sanitizeAdHtml('<div><span>text');
    expect(result).toBe("<div><span>text</span></div>");
  });

  it("丢弃不允许的容器标签但保留文本", () => {
    const result = sanitizeAdHtml('<iframe src="https://evil"></iframe><form><input name="x" />text</form>');
    expect(result).toBe("text");
  });

  it("空内容与超长内容返回空字符串", () => {
    expect(sanitizeAdHtml("")).toBe("");
    expect(sanitizeAdHtml("   ")).toBe("");
    expect(sanitizeAdHtml("x".repeat(MAX_AD_HTML_LENGTH + 1))).toBe("");
  });
});
