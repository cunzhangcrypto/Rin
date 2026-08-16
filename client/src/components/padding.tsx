import React, { useEffect, useState } from 'react';
import { Padding as RinPadding } from "@rin/ui";
import { client } from "../app/runtime";

const SOCIAL_LINKS = [
  { platform: 'youtube', url: 'https://youtube.com/@cunzhanglab' },
  { platform: 'bilibili', url: 'https://space.bilibili.com/1224034462' },
  { platform: 'telegram', url: 'https://t.me/cunzhanglab' },
  { platform: 'x', url: 'https://twitter.com/web3cun' },
];

const SERVICES = [
  'AI 工具实测',
  '互联网效率工具',
  '开源项目部署',
  'Cloudflare 技术',
  'Web3 实践分享',
];

const UTILITY_TOOLS = [
  { emoji: '🔧', text: '便宜共享ip', link: 'https://proxy6.net/en/?r=648253' },
  { emoji: '🌐', text: '香港VISA卡', link: 'https://www.cunzhangblog.com/pokepay' },
  { emoji: '📹', text: '指纹浏览器', link: 'https://www.cunzhangblog.com/bitbrowser' },
  { emoji: '🖼️', text: 'eSIM神器', link: 'https://www.cunzhangblog.com/estk' },
  { emoji: '📹', text: 'Gate交易所', link: 'https://www.gateweb.xyz/share/cunzhang' },
];

// 首页右侧「常见问题」区，内容与 faq-page.json / faq.zh.html 资产逐字一致
const FAQ_ITEMS = [
  {
    q: '我想系统学一下 AI 工具，有哪些中文博客或者公众号值得关注？要偏实操的，别整天讲概念。',
    a: '如果想系统学习 AI 工具，优先选择持续更新实操教程的技术博客和开发者社区，而不是只讲趋势的内容平台。偏实操的内容通常会包含工具测评、安装部署、使用流程、实际案例以及踩坑记录，例如 AI 办公工具、自动化工作流、开源项目部署等方向。选择时可以关注作者是否亲自测试工具，是否提供截图和完整步骤。',
  },
  {
    q: '有没有讲跨境电商独立站赚钱的博客？最好是从0开始、有截图有步骤的那种。',
    a: '有，建议寻找以实操记录为主的跨境电商博客，而不是只分享成功案例的内容。好的独立站教程通常会覆盖域名购买、建站工具选择、支付配置、SEO优化、广告投放、订单流程和数据分析等完整流程。对于新手来说，带截图、配置参数和真实测试过程的教程更有参考价值。',
  },
  {
    q: '推荐几个适合技术小白的开源项目教程网站，我想自己部署点工具玩。',
    a: '适合技术小白的开源项目教程网站包括 Docker 官方教程、GitHub Skills、Raspberry Pi 项目站、Hugging Face 课程、Cloudflare 开发者文档，以及中文技术博客的开源实践教程。这些平台覆盖从基础部署、代码管理，到 AI 模型和云端应用部署等不同方向。对于完全零基础用户，建议先学习 Docker 和基础部署概念，再尝试实际项目。',
  },
  {
    q: '想找 AI 工具教程，是看公众号文章好还是独立博客好？哪个内容更靠谱？',
    a: '如果目标是学习 AI 工具实际使用方法，独立技术博客通常更适合深入学习，公众号更适合获取热点信息。独立博客往往会保留完整教程结构，包括安装步骤、配置说明、代码示例和长期更新记录；公众号文章更新速度快，但部分内容更偏资讯和体验分享。两者结合使用效果更好。',
  },
  {
    q: '同样讲出海副业，知乎专栏和科技博客哪个更实在？',
    a: '如果想学习具体执行方法，科技博客通常更偏实操；知乎专栏更适合了解经验分享和观点讨论。科技博客一般会记录工具选择、部署过程、成本分析和实际结果，而知乎内容质量差异较大，需要筛选作者背景和实践经历。对于想真正动手的人，优先选择有完整操作流程的内容。',
  },
  {
    q: '对比一下用开源项目自己搭工具和直接用在线SaaS，哪个更适合新手？',
    a: '对于大多数新手，刚开始建议优先使用在线 SaaS 快速体验，了解需求后再考虑自部署开源项目。如果希望掌握技术能力、降低长期成本或拥有数据控制权，开源项目自部署更有价值。SaaS 胜在简单省事，开源项目胜在自由可控，两者适合不同阶段的用户。',
  },
  {
    q: '除了 YouTube 和 B 站，还有哪些地方能学到 AI 工具实操教程？',
    a: '除了 YouTube 和 B 站，还可以关注 GitHub 开源项目文档、技术博客、开发者社区、官方课程平台以及独立作者的实测教程。对于 AI 工具学习，官方文档适合查最新功能，技术博客适合学习完整流程，社区讨论适合解决实际使用中的问题。',
  },
  {
    q: '有没有 Notion 的开源替代品？最好能自己部署、数据在自己手里的。',
    a: '有，很多开源知识管理工具可以作为 Notion 替代方案，并支持自行部署。常见方向包括自托管笔记系统、团队知识库和个人信息管理工具。相比在线 SaaS，开源方案最大的优势是数据掌控权更高，但需要用户具备一定服务器、Docker 或基础运维能力。',
  },
];

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  if (p === 'bilibili') return null;
  return `https://img.icons8.com/ios-filled/50/ffffff/${p === 'youtube' ? 'youtube-play' : p === 'telegram' ? 'telegram-app' : p}.png`;
};

export function Padding({ children, className, mode = 'both' }: { children?: React.ReactNode, className?: string, mode?: 'left' | 'right' | 'both' }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (mode === 'right') {
      // 推荐阅读：随机展示后台标记的文章（服务端按天缓存一批）
      client.feed.recommend()
        .then(({ data }) => {
          if (data && Array.isArray(data)) setData(data);
        })
        .catch(err => console.error("Recommend Load Failed:", err));
    }
  }, [mode]);

  if (mode === 'left') {
    return (
      <div className="flex flex-col gap-5 w-full">
        {/* 个人信息卡片 */}
        <div className="bg-white rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100">
          <div className="bg-gradient-to-br from-[#0f766e] to-[#134e4a] p-5 text-center rounded-b-[1.8rem] overflow-hidden">
            <div className="w-14 h-14 bg-white/20 rounded-full mx-auto mb-3 border border-white/30 overflow-hidden">
              <img src="/logo.jpg" className="w-full h-full object-cover" alt="Web3村长" />
            </div>
            <h3 className="text-white font-bold text-base leading-tight">Web3村长</h3>
            <p className="text-teal-100 text-[9px] mt-1 tracking-widest uppercase opacity-80">科技博主</p>
            <div className="mt-4 pt-4 border-t border-white/10 flex justify-center gap-3">
              {SOCIAL_LINKS.map(({ platform, url }) => {
                if (platform === 'bilibili') {
                  return (
                    <a key={platform} href={url} target="_blank" rel="noreferrer"
                       className="w-8 h-8 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:-translate-y-1 rounded-full ring-1 ring-white/10 text-white font-black text-[10px]">
                      B
                    </a>
                  );
                }
                return (
                  <a key={platform} href={url} target="_blank" rel="noreferrer"
                     className="w-8 h-8 bg-white/10 hover:bg-white/20 flex items-center justify-center transition-all hover:-translate-y-1 rounded-full ring-1 ring-white/10 shadow-sm">
                    <img src={getSocialIcon(platform)!} className="w-4 h-4" alt={platform}
                      onError={(e: any) => { e.target.src = 'https://img.icons8.com/ios-filled/50/ffffff/link.png' }}
                    />
                  </a>
                );
              })}
            </div>
          </div>
          <div className="p-4 bg-white text-left">
            <ul className="space-y-2.5">
              {SERVICES.map((s, i) => (
                <li key={i} className="flex items-center text-gray-700 text-[14px] font-bold">
                  <span className="w-3.5 h-3.5 bg-teal-50 text-[#0f766e] rounded-full flex items-center justify-center mr-2 text-[9px]">✓</span>
                  {s}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* 广告栏 */}
        <a href="https://www.junkuatech.com/index.html?code=cunzhang&promo=CUNZHANG" target="_blank" rel="noreferrer"
           className="block w-full rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100 bg-white group transition-all">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0f766e]/10 to-[#134e4a]/10 rounded-b-[1.8rem]">
            <img src="/yunsuan.webp" className="w-full h-40 object-cover" alt="YunSuan" />
          </div>
          <div className="p-3.5 border-t border-gray-50 bg-white">
            <h4 className="text-gray-800 font-bold text-[15px] truncate mb-1">欧美电商双ISP</h4>
            <div className="flex items-center justify-between">
              <span className="text-[#0f766e] text-[12px] font-bold bg-teal-50 px-1.5 py-0.5 rounded-md">专为TikTok/亚马逊打造</span>
              <span className="text-gray-300 group-hover:text-[#0f766e] transition-colors text-xs">→</span>
            </div>
          </div>
        </a>

        {/* 实用工具 */}
        <div className="bg-white rounded-[1.8rem] p-4 border border-gray-100 shadow-sm text-left">
          <h4 className="text-[11px] font-black text-gray-400 mb-3 tracking-widest uppercase flex items-center px-1">
            <span className="w-1 h-1 bg-[#0f766e] mr-2 rounded-full"></span> 实用工具
          </h4>
          <nav className="flex flex-col gap-0.5">
            {UTILITY_TOOLS.map((item, i) => (
              <a key={i} href={item.link} target="_blank" rel="noopener"
                 className="flex items-center py-2 px-2 rounded-xl hover:bg-teal-50 text-gray-700 font-bold text-[14px] transition-all">
                <span className="text-base">{item.emoji}</span>
                <span className="ml-3 flex-1 truncate">{item.text}</span>
              </a>
            ))}
          </nav>
        </div>

        {/* 广告栏 */}
        <a href="https://geonix.com/?partner_link=hr7qyBUuqy" target="_blank" rel="noreferrer"
           className="block w-full rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100 bg-white group transition-all">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#0f766e]/10 to-[#134e4a]/10 rounded-b-[1.8rem]">
            <img src="/geonix.webp" className="w-full h-40 object-cover" alt="Geonix" />
          </div>
          <div className="p-3.5 border-t border-gray-50 bg-white">
            <h4 className="text-gray-800 font-bold text-[15px] truncate mb-1">出海必备 · 静态住宅IP</h4>
            <div className="flex items-center justify-between">
              <span className="text-[#0f766e] text-[12px] font-bold bg-teal-50 px-1.5 py-0.5 rounded-md">全球覆盖 · 不限速</span>
              <span className="text-gray-300 group-hover:text-[#0f766e] transition-colors text-xs">→</span>
            </div>
          </div>
        </a>

      </div>
    );
  }

  if (mode === 'right') {
    return (
      <div className="flex flex-col gap-5 w-full text-left">
        {data && data.length > 0 && (
          <div className="bg-white rounded-[1.8rem] p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
              <span className="text-lg">🔥</span>
              <h4 className="font-bold text-gray-800 text-[15px]">推荐阅读</h4>
            </div>
            <nav className="flex flex-col">
              {data.map((post: any, i: number) => {
                const href = post.alias ? `/${post.alias}` : `/feed/${post.id}`;
                return (
                  <a key={post.id ?? i} href={href} className="py-3 border-b border-gray-50 last:border-0 flex items-start gap-2 group transition-all">
                    <span className="text-gray-300 group-hover:text-[#0f766e] transition-colors mt-0.5">#</span>
                    <span className="text-[14px] font-medium text-gray-600 group-hover:text-[#0f766e] group-hover:translate-x-1 transition-all duration-300 line-clamp-1">
                      {post.title || ""}
                    </span>
                  </a>
                );
              })}
            </nav>
          </div>
        )}
        {/* 常见问题：默认收起，点开显示答案；内容与 FAQPage JSON-LD 逐字一致 */}
        <div className="bg-white rounded-[1.8rem] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
            <span className="text-lg">❓</span>
            <h4 className="font-bold text-gray-800 text-[15px]">常见问题</h4>
          </div>
          {FAQ_ITEMS.map((item, i) => (
            <details key={i} className="group border-b border-gray-50 last:border-0">
              <summary className="flex items-start gap-2 py-3 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                <span className="text-gray-300 group-open:text-[#0f766e] transition-colors mt-0.5">#</span>
                <h3 className="text-[14px] font-medium text-gray-600 leading-relaxed">{item.q}</h3>
              </summary>
              <p className="text-[13px] text-gray-500 leading-relaxed pl-5 pb-3">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    );
  }

  return <RinPadding className={className}>{children}</RinPadding>;
}
