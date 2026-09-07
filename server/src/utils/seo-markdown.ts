import { unified } from "unified";
import remarkParse from "remark-parse";

/**
 * 把 Markdown 去语法后转成可读的纯文本，用于生成干净的 SEO description。
 * 移除图片、链接占位、标题/列表记号、表格竖线等，压缩连续空白。
 */
export function stripMarkdown(markdown: string): string {
  return (markdown || "")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // 图片
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // 链接保留文字
    .replace(/^#{1,6}\s+/gm, "") // 标题
    .replace(/^\s{0,3}>\s?/gm, "") // 引用
    .replace(/^\s*[-*+]\s+/gm, "") // 无序列表
    .replace(/^\s*\d+[.、)]\s+/gm, "") // 有序列表
    .replace(/`{1,3}/g, "") // 行内/块代码反引号
    .replace(/(\*\*|__)(.*?)\1/g, "$2") // 加粗
    .replace(/([*_])([^*_]*)\1/g, "$2") // 斜体
    .replace(/\|/g, " ") // 表格竖线
    .replace(/[^\S\n]+/g, " ") // 连续空白
    .replace(/\s*\n+\s*/g, " ") // 换行转空格
    .trim();
}

export interface FaqItem {
  q: string;
  a: string;
}

/** mdast 节点类型 */
type MdastNode = {
  type: string;
  depth?: number;
  children?: MdastNode[];
  value?: string;
  [key: string]: unknown;
};

/** 递归收集节点的纯文本值 */
function collectText(node: MdastNode): string {
  if (node.value !== undefined) {
    return String(node.value);
  }
  if (node.children) {
    return node.children.map(collectText).join("").trim();
  }
  return "";
}

/**
 * 从文章正文提取 FAQ 小节（形如 `## FAQ` 下的一组 `### 问题` + 段落答案），
 * 用于生成 FAQPage 结构化数据。找不到则返回空数组。
 */
export function extractFaq(markdown: string): FaqItem[] {
  const tree = unified().use(remarkParse).parse(markdown || "") as unknown as MdastNode;
  const items: FaqItem[] = [];

  // 常见 FAQ 小节标题关键词
  const FAQQ_HEADING = /^(faq|常见问题|常见疑难|问答|q&a|questions?)\b/i;

  let inFaq = false;
  let question: string | null = null;
  let answer: string[] = [];

  const flush = () => {
    if (question && answer.length) {
      items.push({ q: question, a: answer.join(" ").replace(/\s+/g, " ").trim() });
    }
    question = null;
    answer = [];
  };

  const walk = (node: MdastNode) => {
    if (node.type === "heading" && typeof node.depth === "number") {
      const text = collectText(node).trim();
      // 顶层小节用 h2 界定 FAQ 范围；对齐平台约定的层级后可放开对 h3 的判断
      if (node.depth >= 2 && node.depth <= 3 && FAQQ_HEADING.test(text)) {
        inFaq = true;
        flush();
        return;
      }
      if (node.depth === 2 && !FAQQ_HEADING.test(text)) {
        // 遇到下一个非 FAQ 顶层小节，FAQ 段结束
        inFaq = false;
        flush();
        return;
      }
      if (inFaq && node.depth === 3) {
        flush();
        question = text;
        return;
      }
      if (node.depth > 3 && inFaq && question) {
        // h4 等作为答案的一部分被下方 collectText 捕获
      }
      return;
    }

    if (inFaq && question && node.children) {
      const text = collectText(node).trim();
      if (text) {
        answer.push(text);
      }
    }
    // 继续向下遍历（table/列表内部也收集文本）
    if (node.children) {
      node.children.forEach(walk);
    }
  };

  (tree.children || []).forEach(walk);
  flush();
  return items;
}