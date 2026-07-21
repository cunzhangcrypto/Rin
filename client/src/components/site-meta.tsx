import { Helmet } from "react-helmet";
import { useSiteConfig } from "../hooks/useSiteConfig";
import { stripImageUrlMetadata } from "../utils/image-upload";

interface SiteMetaProps {
    title?: string;
    description?: string;
    image?: string;
    children: React.ReactNode;
}

const jsonLd = {
    "@context": "https://schema.org",
    "@graph": [
        {
            "@type": "Person",
            "@id": "https://www.cunzhangblog.com/#person",
            "name": "Web3村长",
            "alternateName": ["Cunzhang", "cunzhangcrypto"],
            "url": "https://www.cunzhangblog.com/about",
            "description": "Web3村长是一名专注分享AI工具、Web3技术、互联网工具和数字生产力方法的内容创作者。",
            "sameAs": [
                "https://youtube.com/@cunzhangcrypto",
                "https://space.bilibili.com/1224034462",
                "https://github.com/cunzhangcrypto",
                "https://twitter.com/web3cun",
                "https://t.me/cunzhangcrypto"
            ]
        },
        {
            "@type": "Organization",
            "@id": "https://www.cunzhangblog.com/#organization",
            "name": "Web3村长博客",
            "url": "https://www.cunzhangblog.com",
            "logo": {
                "@type": "ImageObject",
                "url": "https://www.cunzhangblog.com/logo.png"
            },
            "owns": {
                "@type": "Organization",
                "name": "村长AI工具箱",
                "url": "https://www.cunzhangai.com"
            }
        },
        {
            "@type": "WebSite",
            "@id": "https://www.cunzhangblog.com/#website",
            "url": "https://www.cunzhangblog.com",
            "name": "Web3村长博客",
            "publisher": { "@id": "https://www.cunzhangblog.com/#organization" },
            "about": { "@id": "https://www.cunzhangblog.com/#person" }
        }
    ]
};

export function SiteMeta({ title, description, image, children }: SiteMetaProps) {
    const siteConfig = useSiteConfig();

    const pageTitle = title 
        ? `${title} - ${siteConfig.name}` 
        : siteConfig.name;

    const pageDescription = description || siteConfig.description;
    const pageImage = stripImageUrlMetadata(image || siteConfig.avatar);

    return (
        <>
            <Helmet>
                <title>{pageTitle}</title>
                <meta property="og:title" content={pageTitle} />
                <meta property="og:description" content={pageDescription} />
                {pageImage && <meta property="og:image" content={pageImage} />}
                <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
            </Helmet>
            {children}
        </>
    );
}
