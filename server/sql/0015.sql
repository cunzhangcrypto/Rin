CREATE TABLE IF NOT EXISTS `ads` (
  `id` integer PRIMARY KEY NOT NULL,
  `name` text NOT NULL,
  `type` text DEFAULT 'html' NOT NULL,
  `html` text DEFAULT '' NOT NULL,
  `html_sanitized` text DEFAULT '' NOT NULL,
  `image` text DEFAULT '' NOT NULL,
  `url` text DEFAULT '' NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `weight` integer DEFAULT 10 NOT NULL,
  `start_at` integer,
  `end_at` integer,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ad_slots` (
  `slot` text PRIMARY KEY NOT NULL,
  `enabled` integer DEFAULT 1 NOT NULL,
  `mode` text DEFAULT 'weighted' NOT NULL,
  `max_count` integer DEFAULT 1 NOT NULL,
  `min_gap` integer DEFAULT 3 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  `updated_at` integer DEFAULT (unixepoch()) NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS `ad_links` (
  `id` integer PRIMARY KEY NOT NULL,
  `ad_id` integer NOT NULL,
  `slot` text NOT NULL,
  `sort_order` integer DEFAULT 0 NOT NULL,
  `created_at` integer DEFAULT (unixepoch()) NOT NULL,
  FOREIGN KEY (`ad_id`) REFERENCES `ads`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS `ad_links_ad_slot_idx` ON `ad_links` (`ad_id`, `slot`);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS `ad_links_slot_idx` ON `ad_links` (`slot`);
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_slots` (`slot`, `enabled`, `mode`, `max_count`, `min_gap`) VALUES
  ('left', 1, 'weighted', 1, 3),
  ('right_top', 1, 'weighted', 1, 3),
  ('right_bottom', 1, 'weighted', 1, 3),
  ('inline', 1, 'weighted', 1, 3);
--> statement-breakpoint
INSERT INTO `ads` (`name`, `type`, `html`, `html_sanitized`, `image`, `url`, `enabled`, `weight`)
SELECT 'Geonix 静态住宅IP', 'html',
'<a href="https://geonix.com/?partner_link=hr7qyBUuqy" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:block;width:100%;border-radius:1.8rem;overflow:hidden;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/geonix.webp" alt="Geonix" loading="lazy" style="display:block;width:100%;height:160px;object-fit:cover;" /><div style="padding:14px;border-top:1px solid #f9fafb;background:#ffffff;text-align:left;"><div style="font-weight:700;font-size:15px;color:#1f2937;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">出海必备 · 静态住宅IP</div><div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#0f766e;font-size:12px;font-weight:700;background:#f0fdfa;padding:2px 6px;border-radius:6px;">全球覆盖 · 不限速</span><span style="color:#d1d5db;font-size:12px;">→</span></div></div></a>',
'<a href="https://geonix.com/?partner_link=hr7qyBUuqy" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:block;width:100%;border-radius:1.8rem;overflow:hidden;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/geonix.webp" alt="Geonix" loading="lazy" style="display:block;width:100%;height:160px;object-fit:cover;" /><div style="padding:14px;border-top:1px solid #f9fafb;background:#ffffff;text-align:left;"><div style="font-weight:700;font-size:15px;color:#1f2937;margin-bottom:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">出海必备 · 静态住宅IP</div><div style="display:flex;align-items:center;justify-content:space-between;"><span style="color:#0f766e;font-size:12px;font-weight:700;background:#f0fdfa;padding:2px 6px;border-radius:6px;">全球覆盖 · 不限速</span><span style="color:#d1d5db;font-size:12px;">→</span></div></div></a>',
'', 'https://geonix.com/?partner_link=hr7qyBUuqy', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `ads`);
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_links` (`ad_id`, `slot`, `sort_order`)
SELECT `id`, 'left', 0 FROM `ads` WHERE `name` = 'Geonix 静态住宅IP';
--> statement-breakpoint
INSERT INTO `ads` (`name`, `type`, `html`, `html_sanitized`, `image`, `url`, `enabled`, `weight`)
SELECT 'VPS 推广', 'html',
'<a href="https://go.czlab.dev/vps" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/zhenghui_ads.webp" alt="VPS 推广" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">跨境网络，真正需要的是一台VPS</span><span style="font-size:13px;color:#9ca3af;">多地区海外节点，独享算力与稳定网络，电商、搭节点都能用</span></div></a>',
'<a href="https://go.czlab.dev/vps" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/zhenghui_ads.webp" alt="VPS 推广" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">跨境网络，真正需要的是一台VPS</span><span style="font-size:13px;color:#9ca3af;">多地区海外节点，独享算力与稳定网络，电商、搭节点都能用</span></div></a>',
'', 'https://go.czlab.dev/vps', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `ads` WHERE `name` = 'VPS 推广');
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_links` (`ad_id`, `slot`, `sort_order`)
SELECT `id`, 'inline', 0 FROM `ads` WHERE `name` = 'VPS 推广';
--> statement-breakpoint
INSERT INTO `ads` (`name`, `type`, `html`, `html_sanitized`, `image`, `url`, `enabled`, `weight`)
SELECT 'Geonix 代理IP', 'html',
'<a href="https://go.czlab.dev/geonix" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/geonix_ads.webp" alt="Geonix 代理IP" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">全球高质量代理IP，助力业务无界增长</span><span style="font-size:13px;color:#9ca3af;">覆盖200+国家，提供机房IP、住宅IP、手机IP，满足多场景业务需求</span></div></a>',
'<a href="https://go.czlab.dev/geonix" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/geonix_ads.webp" alt="Geonix 代理IP" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">全球高质量代理IP，助力业务无界增长</span><span style="font-size:13px;color:#9ca3af;">覆盖200+国家，提供机房IP、住宅IP、手机IP，满足多场景业务需求</span></div></a>',
'', 'https://go.czlab.dev/geonix', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `ads` WHERE `name` = 'Geonix 代理IP');
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_links` (`ad_id`, `slot`, `sort_order`)
SELECT `id`, 'inline', 1 FROM `ads` WHERE `name` = 'Geonix 代理IP';
--> statement-breakpoint
INSERT INTO `ads` (`name`, `type`, `html`, `html_sanitized`, `image`, `url`, `enabled`, `weight`)
SELECT '海外成品账号', 'html',
'<a href="https://go.czlab.dev/accounts" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/accountboy_ads.webp" alt="海外成品账号" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">海外成品账号，买来即用省心省钱！</span><span style="font-size:13px;color:#9ca3af;">海外账号与AI订阅，一站购买，告别注册与订阅的麻烦事</span></div></a>',
'<a href="https://go.czlab.dev/accounts" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/accountboy_ads.webp" alt="海外成品账号" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">海外成品账号，买来即用省心省钱！</span><span style="font-size:13px;color:#9ca3af;">海外账号与AI订阅，一站购买，告别注册与订阅的麻烦事</span></div></a>',
'', 'https://go.czlab.dev/accounts', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `ads` WHERE `name` = '海外成品账号');
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_links` (`ad_id`, `slot`, `sort_order`)
SELECT `id`, 'inline', 2 FROM `ads` WHERE `name` = '海外成品账号';
--> statement-breakpoint
INSERT INTO `ads` (`name`, `type`, `html`, `html_sanitized`, `image`, `url`, `enabled`, `weight`)
SELECT '比特浏览器', 'html',
'<a href="https://go.czlab.dev/bitbrowser" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/bitbrowser_ads.webp" alt="比特浏览器" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">新用户永久免费10个指纹窗口</span><span style="font-size:13px;color:#9ca3af;">指纹隔离 · 独立环境 · 多账号一站式管理</span></div></a>',
'<a href="https://go.czlab.dev/bitbrowser" target="_blank" rel="nofollow sponsored noopener noreferrer" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;box-shadow:0 1px 2px rgba(0,0,0,0.05);"><img src="/bitbrowser_ads.webp" alt="比特浏览器" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" /><div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;"><span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">新用户永久免费10个指纹窗口</span><span style="font-size:13px;color:#9ca3af;">指纹隔离 · 独立环境 · 多账号一站式管理</span></div></a>',
'', 'https://go.czlab.dev/bitbrowser', 1, 10
WHERE NOT EXISTS (SELECT 1 FROM `ads` WHERE `name` = '比特浏览器');
--> statement-breakpoint
INSERT OR IGNORE INTO `ad_links` (`ad_id`, `slot`, `sort_order`)
SELECT `id`, 'inline', 3 FROM `ads` WHERE `name` = '比特浏览器';
--> statement-breakpoint
UPDATE `info` SET `value` = '15' WHERE `key` = 'migration_version';
