import React, { useEffect, useRef, useState } from 'react';
import { Padding as RinPadding } from "@rin/ui";

const SOCIAL_LINKS = [
  { platform: 'youtube', url: 'https://youtube.com/@cunzhangcrypto' },
  { platform: 'bilibili', url: 'https://space.bilibili.com/1224034462' },
  { platform: 'telegram', url: 'https://t.me/cunzhangcrypto' },
  { platform: 'x', url: 'https://twitter.com/web3cun' },
];

const SERVICES = [
  '跨境支付 / 虚拟卡',
  'AI 自动化工作流',
  '网络安全 / 隐私工具',
  '互联网科技工具',
  '区块链 / 动态资讯',
];

const UTILITY_TOOLS = [
  { emoji: '🔧', text: '便宜共享ip', link: 'https://proxy6.net/en/?r=648253' },
  { emoji: '🌐', text: '香港VISA卡', link: 'https://www.cunzhangblog.com/pokepay' },
  { emoji: '📹', text: '指纹浏览器', link: 'https://www.cunzhangblog.com/bitbrowser' },
  { emoji: '🖼️', text: 'eSIM神器', link: 'https://www.cunzhangblog.com/estk' },
  { emoji: '📹', text: 'Gate交易所', link: 'https://www.gateweb.xyz/share/cunzhang' },
  { emoji: '📢', text: '广告展示', link: 'https://www.effectivecpmnetwork.com/fykm9ug84?key=925835599c2a0eabe506808b07baabc9' },
];

const getSocialIcon = (platform: string) => {
  const p = platform.toLowerCase();
  if (p === 'bilibili') return null;
  return `https://img.icons8.com/ios-filled/50/ffffff/${p === 'youtube' ? 'youtube-play' : p === 'telegram' ? 'telegram-app' : p}.png`;
};

function AdsterraBanner() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // 设置全局 atOptions
    (window as any).atOptions = {
      'key' : '3dfa1edc31e8142f46096dcf91f36c64',
      'format' : 'iframe',
      'height' : 250,
      'width' : 300,
      'params' : {},
    };

    // 加载广告脚本
    const script = document.createElement('script');
    script.src = 'https://www.highperformanceformat.com/3dfa1edc31e8142f46096dcf91f36c64/invoke.js';
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    container.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
      delete (window as any).atOptions;
    };
  }, []);

  return (
    <div className="bg-white rounded-[1.8rem] overflow-hidden shadow-sm border border-gray-100 text-center" style={{ minHeight: '250px' }}>
      <div ref={containerRef} />
    </div>
  );
}

export function Padding({ children, className, mode = 'both' }: { children?: React.ReactNode, className?: string, mode?: 'left' | 'right' | 'both' }) {
  const [data, setData] = useState<any>(null);

  useEffect(() => {
    if (mode === 'right') {
      fetch('https://video.cunzhangai.com/sidebar.json', { cache: 'no-cache' })
        .then(res => res.json())
        .then(json => setData(json))
        .catch(err => console.error("R2 Data Load Failed:", err));
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

        {/* 实用工具 */}
        <div className="bg-white rounded-[1.8rem] p-4 border border-gray-100 shadow-sm text-left">
          <h4 className="text-[11px] font-black text-gray-400 mb-3 tracking-widest uppercase flex items-center px-1">
            <span className="w-1 h-1 bg-[#0f766e] mr-2 rounded-full"></span> 实用工具
          </h4>
          <nav className="flex flex-col gap-0.5">
            {UTILITY_TOOLS.map((item, i) => (
              <a key={i} href={item.link} target="_blank" rel="noreferrer"
                 className="flex items-center py-2 px-2 rounded-xl hover:bg-teal-50 text-gray-700 font-bold text-[14px] transition-all">
                <span className="text-base">{item.emoji}</span>
                <span className="ml-3 flex-1 truncate">{item.text}</span>
              </a>
            ))}
          </nav>
        </div>

        {/* Adsterra 广告 300x250 */}
        <AdsterraBanner />

      </div>
    );
  }

  if (mode === 'right') {
    if (!data || !data.latestPosts) return null;
    return (
      <div className="flex flex-col gap-5 w-full text-left">
        <div className="bg-white rounded-[1.8rem] p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-2 mb-4 pb-2 border-b border-gray-50">
            <span className="text-lg">🔥</span>
            <h4 className="font-bold text-gray-800 text-[15px]">推荐阅读</h4>
          </div>
          <nav className="flex flex-col">
            {data.latestPosts.map((post: any, i: number) => (
              <a key={i} href={post.url} className="py-3 border-b border-gray-50 last:border-0 flex items-start gap-2 group transition-all">
                <span className="text-gray-300 group-hover:text-[#0f766e] transition-colors mt-0.5">#</span>
                <span className="text-[14px] font-medium text-gray-600 group-hover:text-[#0f766e] group-hover:translate-x-1 transition-all duration-300 line-clamp-1">
                  {post.title}
                </span>
              </a>
            ))}
          </nav>
        </div>
      </div>
    );
  }

  return <RinPadding className={className}>{children}</RinPadding>;
}
