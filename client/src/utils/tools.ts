export type ToolItem = { name: string; url: string; desc: string };

// 工具名称+描述关键词 → emoji 图标自动匹配（按顺序，第一个命中的生效）
const TOOL_EMOJI_MAP: [RegExp, string][] = [
  [/pdf|word|文档/i, "📄"],
  [/音乐|播放器/i, "🎵"],
  [/下载|idm|gopeed|reclip/i, "⬇️"],
  [/录屏|屏幕|obs/i, "🖥️"],
  [/浏览器|chrome|插件/i, "🌐"],
  [/清理|卸载|禁止更新/i, "🧹"],
  [/水印/i, "🖼️"],
  [/语音|voice|声音/i, "🎙️"],
  [/qwen|ai|大模型|llm|模型/i, "🤖"],
  [/ppt/i, "📊"],
  [/网盘|转存/i, "☁️"],
  [/ffmpeg|压缩|转码/i, "🎞️"],
  [/文件传输|传输/i, "📁"],
  [/投屏|手机/i, "📱"],
  [/复制/i, "📋"],
  [/字幕|剪辑|剪映|视频/i, "🎬"],
  [/ocr|识别/i, "🔍"],
];

export function getToolEmoji(name: string, desc: string): string {
  const text = `${name} ${desc}`;
  for (const [pattern, emoji] of TOOL_EMOJI_MAP) {
    if (pattern.test(text)) return emoji;
  }
  return "📦";
}

// 解析 /tools.md：每行「工具名 - url - 描述」
function parseToolLines(text: string): ToolItem[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line && !line.startsWith("#"))
    .map((line) => {
      const parts = line.split(" - ");
      const name = parts[0]?.trim();
      const url = parts[1]?.trim();
      const desc = parts.slice(2).join(" - ").trim();
      if (!name || !url || !/^https?:\/\//.test(url)) return null;
      return { name, url, desc };
    })
    .filter(Boolean) as ToolItem[];
}

export async function fetchTools(): Promise<ToolItem[]> {
  try {
    const res = await fetch("/tools.md");
    if (!res.ok) return [];
    return parseToolLines(await res.text());
  } catch {
    return [];
  }
}

// 随机抽取 count 条工具（每次调用都会更换顺序）
export function pickRandomTools(list: ToolItem[], count: number): ToolItem[] {
  return [...list].sort(() => Math.random() - 0.5).slice(0, count);
}