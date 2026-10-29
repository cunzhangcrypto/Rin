import type { PublicAd } from "@rin/api";

// 广告卡片：HTML 类型直接渲染服务端净化后的代码；图片类型使用统一卡片外壳
export function AdCard({ ad, className }: { ad: PublicAd; className?: string }) {
  if (ad.type === "image") {
    return (
      <div className={`w-full overflow-hidden rounded-[1.4rem] border border-gray-100 bg-white shadow-sm ${className ?? ""}`}>
        <a
          href={ad.url || undefined}
          target="_blank"
          rel="nofollow sponsored noopener noreferrer"
          className="block w-full"
        >
          <img
            src={ad.image}
            alt={ad.title}
            loading="lazy"
            className="block w-full max-w-full h-auto object-cover"
          />
        </a>
      </div>
    );
  }

  return (
    <div
      className={`w-full max-w-full break-words [&_img]:max-w-full [&_img]:h-auto ${className ?? ""}`}
      dangerouslySetInnerHTML={{ __html: ad.html }}
    />
  );
}
