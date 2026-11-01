# AI 智能体（Agent）接入说明

> 本文档面向要接入本博客系统的 AI 智能体（Agent），说明如何通过 HTTP API 让 Agent 像管理员一样发布/修改文章、发布动态。全文以「Agent 视角」撰写，可直接作为 Agent 的配置 / system prompt 素材。

---

## 1. 连接三要素

| 要素 | 值 | 说明 |
|---|---|---|
| API 根地址 | `https://www.cunzhangblog.com/api` | 所有接口以此为前缀（本地开发：`http://localhost:11498/api`） |
| 身份凭证 | `ADMIN_API_KEY` | 博客管理员的独立 API Key（强随机字符串），存储在 Worker 环境变量中 |
| 认证方式 | 请求头 `Authorization: Bearer <ADMIN_API_KEY>` | 所有写操作必须携带；某些操作（草稿/未发布等）也需要 |

> **重要**：`ADMIN_API_KEY` 由站点管理员持有，是写权限凭证。Agent 接入时应由调用方通过安全方式注入，不要硬编码，也不要记录到日志。

---

## 2. 文章管理（Feeds）

### 2.1 发布文章

```
POST /api/feed
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json
```

请求体字段（全部可选校验，但 `title` 与 `content` 为必填）：

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `title` | string | ✅ | 文章标题 |
| `content` | string | ✅ | 文章正文（Markdown） |
| `summary` | string | | 摘要；为空则服务端自动截取正文前 100/200 字 |
| `alias` | string | | 自定义 URL 别名；留空则自动生成。**必须全局唯一**，重名返回 400 |
| `draft` | 0/1 | | 1=草稿（不公开），0=已发布（默认 0） |
| `listed` | 0/1 | | 1=在列表展示（默认 0；若需对外发布，配合 `draft:0` 设 `listed:1`） |
| `tags` | string[] | | 标签名数组；不存在会自动创建 |
| `recommended` | 0/1 | | 1=推荐阅读 |
| `ai_visible` | 0/1 | | 1=进入 GEO/AI 抓取入口 `(/feed/geo)` |
| `createdAt` | string(ISO) | | 自定义发布时间；缺省用当前时间 |

示例：

```bash
curl -X POST "https://www.cunzhangblog.com/api/feed" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "今天用 AI 部署了一个小工具",
    "content": "## 正文\n实际操作步骤……",
    "summary": "动手实测记录",
    "draft": 0,
    "listed": 1,
    "tags": ["AI", "Cloudflare"]
  }'
```

成功返回：

```json
{ "insertedId": 123, "alias": "some-auto-alias" }
```

失败场景：
- 缺 `title` / `content` → `400 Title is required` / `Content is required`
- 标题或正文已存在（查重）→ `400 Content already exists`
- 别名被占用 → `400 别名已存在，请更换后重试`
- 未带合法凭证 → `401` / `403 Permission denied`

### 2.2 修改文章

```
POST /api/feed/:id
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json
```

`:id` 为文章数字 ID。请求体字段与发布相同，**只传需要改的字段**即可（部分更新）。改动正文且文章非草稿时，会自动重新排队生成 AI 摘要。

```bash
curl -X POST "https://www.cunzhangblog.com/api/feed/123" \
  -H "Authorization: Bearer $ADMIN_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"title": "改后的新标题", "draft": 0, "listed": 1}'
```

成功：`200 Updated`；不存在：`404 Not found`。

### 2.3 删除文章

```
DELETE /api/feed/:id
Authorization: Bearer <ADMIN_API_KEY>
```

成功：`200 Deleted`；不存在：`404 Not found`。

### 2.4 置顶文章

```
POST /api/feed/top/:id
Authorization: Bearer <ADMIN_API_KEY>

{ "top": 1 }
```

### 2.5 读取文章（便于 Agent 了解现状，公开接口无需凭证）

```
GET /api/feed?page=1&limit=20
```

- 公开列表：默认只返回已发布（`draft=0`）且上架（`listed=1`）的文章
- 带凭证 `?type=draft` 可查草稿，`?type=unlisted` 查未上架，`?type=recommend` 查推荐
- 返回结构：`{ size, hasNext, data: [...] }`，`data` 含 `id/title/summary/alias/createdAt/updatedAt/hashtags/user/avatar…`

```
GET /api/feed/:id        # 文章详情（id 或 alias 均可）
GET /api/feed/timeline   # 仅 id/title/alias/createdAt 的轻量时间线
GET /api/feed/geo        # AI/GEO 可见文章归档
GET /api/feed/recommend  # 推荐阅读
```

---

## 3. 动态管理（Moments）

动态适合「短内容 + 若干链接」，例如视频号视频的详情文字。**动态内容通常没有图片等复杂元素。**

### 3.1 发布动态

```
POST /api/moments
Authorization: Bearer <ADMIN_API_KEY>
Content-Type: application/json

{ "content": "视频内容详情……\n相关链接：https://…" }
```

成功返回：`{ "insertedId": <id> }`

### 3.2 修改 / 删除动态

```
POST /api/moments/:id      # 更新，body: { "content": "新内容" }
DELETE /api/moments/:id    # 删除
```

### 3.3 读取动态（公开）

```
GET /api/moments?page=1&limit=20   # 列表
GET /api/moments/:id                # 单条详情
```

动态的独立分享链接即：`https://www.cunzhangblog.com/moments/<id>`，详情页已补齐 OG 标签，可分享为卡片。

---

## 4. 认证与错误速查

- **认证**：写接口统一用 `Authorization: Bearer <ADMIN_API_KEY>`；`ADMIN_API_KEY` 由管理员提供。
- **常见状态码**：
  - `200` / 成功（返回 JSON 或文本）
  - `400` 参数错误 / 查重失败 / 别名占用 / 动态缺 content
  - `401` 未提供凭证
  - `403` 权限不足（凭证无效、非管理员，或访问草稿/未上架未带凭证）
  - `404` 资源不存在
  - `500` 服务端失败

---

## 5. 推荐的 Agent 工作流

1. **了解现状**：`GET /api/feeds?limit=10`、`GET /api/moments?limit=10` 看当前内容与风格。
2. **创作发布**：按用户指令生成正文 → `POST /api/feed`（或 `POST /api/moments`）→ 校验返回的 `insertedId`。
3. **修订**：先 `GET /api/feed/:id` 拿到原文 → 局部修改 → `POST /api/feed/:id`。
4. **注意一致性**：`title` 唯一校验、`alias` 唯一校验，发布前先查询避免撞车。

---

## 6. 部署前提示（管理员侧）

- Worker 环境变量需存在 `ADMIN_API_KEY`（GitHub Actions Secrets 亦需同步，否则 Agent 写接口返回 401）。
- 当前为「A+B」加固：认证已用恒定时间比较（时序侧信道防御），Key 建议使用强随机值（如 `openssl rand -hex 32`）。「限流 + 审计」（C）暂未启用，待 AI 运营稳定后按需升级。

---

## 7. 广告系统（Ad System）

广告已后台化：新增/更换广告不需要改前端代码、不需要重新部署，保存即生效。

### 7.1 数据模型

| 表 | 作用 | 说明 |
|---|---|---|
| `ads` | 广告素材 | 一条广告本体，存原始 HTML 或图片 URL |
| `ad_slots` | 广告位配置 | 固定 4 行：`left` / `right_top` / `right_bottom` / `inline` |
| `ad_links` | 素材与广告位关联 | `ad_id + slot` 唯一，`sort_order` 决定顺序 |

一个素材可投多个广告位；一个广告位可挂多个素材轮播。前台只渲染服务端净化后的 `html_sanitized`。

### 7.2 四个广告位

| key | 后台名称 | 位置 | 每次展示 | 移动端 |
|---|---|---|---|---|
| `left` | 左侧边栏 | 桌面左栏「个人名片」下方、20 条工具上方 | 1 条 | 页面最底部（文章页在评论区之后），仅「名片 + 该广告」 |
| `right_top` | 右侧推荐上方 | 桌面右栏「推荐阅读」上方 | 1 条 | 隐藏 |
| `right_bottom` | 右侧推荐下方 | 桌面右栏「推荐阅读」下方 | 1 条 | 隐藏 |
| `inline` | 文章正文 | 正文中间按段落自动插入 | `max_count` 条（1–5） | 正常显示 |

桌面侧栏仅在视口 ≥1536px 出现。广告位为空 / 停用 / 无可投放素材时完全不占位。

### 7.3 素材字段（`ads`）

| 字段 | 类型 | 默认 | 语义 |
|---|---|---|---|
| `name` | string | 必填 | 后台识别名，≤60 字符，前台不展示 |
| `type` | `html` \| `image` | `html` | 素材类型 |
| `html` | string | `''` | 原始 HTML，`type=html` 必填，≤200,000 字符 |
| `html_sanitized` | string | 自动 | 保存时生成的净化结果，只读 |
| `image` | string | `''` | `type=image` 必填，站内路径或 https URL |
| `url` | string | `''` | 点击跳转地址，`image` 类型下生效 |
| `enabled` | 0/1 | 1 | 1 投放 / 0 停用 |
| `weight` | integer | 10 | 0–1000，加权随机的权重 |
| `start_at` | integer | NULL | 开始时间（unix 秒），空为不限 |
| `end_at` | integer | NULL | 结束时间，空为不限，不得早于 `start_at` |

投放资格 = `enabled=1` 且当前时间在投放窗口内 且（`type=image` 或 `html_sanitized` 非空）且已关联到该广告位。

### 7.4 广告位字段（`ad_slots`）

| 字段 | 默认 | 语义 |
|---|---|---|
| `slot` | — | 主键，仅 4 个合法 key |
| `enabled` | 1 | 0 = 整个广告位关闭 |
| `mode` | `weighted` | `fixed` 按顺序取前 N；`random` 等概率且不重复；`weighted` 按权重且不重复 |
| `max_count` | 1 | 仅 `inline` 生效，1–5 条 |
| `min_gap` | 3 | 仅 `inline` 生效，1–20 个段落间隔 |

### 7.5 HTML 素材规则

**允许标签**：`div` `span` `a` `p` `ul` `ol` `li` `strong` `b` `em` `i` `small` `img` `br` `h1`–`h4`

**允许属性**：通用 `style`、`title`；`<a>` 额外 `href`、`target`；`<img>` 额外 `src`、`alt`、`width`、`height`、`loading`

**会被丢弃**：`class` / `id` / `data-*`（必须改用行内 `style`）、所有 `on*` 事件、`<script>` 与 `<style>` 及其内部内容、非白名单标签（标签删除、文字保留）

**允许的 CSS**：`color` `background*` `border*` `border-radius` `padding*` `margin*` `font*` `line-height` `letter-spacing` `text-align` `text-decoration` `display` `flex*` `gap` `width` `height` `min/max-width` `min/max-height` `object-fit` `overflow*` `white-space` `word-break` `box-shadow` `opacity` `vertical-align` `list-style*`

**禁止**：`position`、`z-index`、`top/left/right/bottom`、`expression`、`javascript:`、`vbscript:`、`behavior:`、`@import`、`</`、`<script`；`url()` 内只允许 http/https 或站内相对路径（禁 `data:`）

**自动处理**：带 `href` 的 `<a>` 自动补 `target="_blank"` 与 `rel="nofollow sponsored noopener noreferrer"`；未闭合标签自动补齐；非法图片地址移除 `src`。

**尺寸参考**：`left` 容器 240px（桌面）/ 360px（移动），图片建议宽 100%、高约 160px、`object-fit:cover`；`inline` 与正文同宽，横卡常用 220×96 配右侧文字。

左侧卡片模板：

```html
<a href="https://example.com" style="display:block;width:100%;border-radius:1.8rem;overflow:hidden;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;">
  <img src="/ad.webp" alt="广告" loading="lazy" style="display:block;width:100%;height:160px;object-fit:cover;" />
  <div style="padding:14px;border-top:1px solid #f9fafb;text-align:left;">
    <div style="font-weight:700;font-size:15px;color:#1f2937;margin-bottom:4px;">主标题</div>
    <div style="display:flex;align-items:center;justify-content:space-between;">
      <span style="color:#0f766e;font-size:12px;font-weight:700;background:#f0fdfa;padding:2px 6px;border-radius:6px;">卖点标签</span>
      <span style="color:#d1d5db;font-size:12px;">→</span>
    </div>
  </div>
</a>
```

正文横卡模板：

```html
<a href="https://example.com" style="display:flex;flex-wrap:wrap;overflow:hidden;border-radius:1rem;border:1px solid #f3f4f6;background:#ffffff;text-decoration:none;">
  <img src="/ad.webp" alt="广告" loading="lazy" style="display:block;width:100%;max-width:220px;height:96px;object-fit:cover;flex-shrink:0;" />
  <div style="flex:1;min-width:180px;padding:12px 16px;display:flex;flex-direction:column;justify-content:center;gap:4px;text-align:left;">
    <span style="font-size:20px;font-weight:500;color:#0f766e;line-height:1.3;">大标题文案</span>
    <span style="font-size:13px;color:#9ca3af;">一句话补充说明</span>
  </div>
</a>
```

### 7.6 图片素材

`type=image` 只填 `image`（URL，不提供上传）与 `url`（跳转地址）；前台自动套圆角卡片并强制 AFF 的 `rel`。图片与 HTML 二选一渲染。

### 7.7 广告 API

认证：`Authorization: Bearer <ADMIN_API_KEY>`（与第 1 节一致）；也可用浏览器登录后的 `token` Cookie。

| 方法 | 路径 | 用途 |
|---|---|---|
| GET | `/api/ads` | 前台数据（已净化、已过滤），公开 |
| GET | `/api/ads/admin` | 后台数据：`{ materials, slots }` |
| POST | `/api/ads/admin/preview` | 只净化不保存，入参 `{ html }` → `{ html }` |
| POST | `/api/ads/admin/ad` | 新建素材 → `{ success, id }` |
| POST | `/api/ads/admin/ad/:id` | 全量更新素材 |
| POST | `/api/ads/admin/ad/:id/duplicate` | 复制素材（副本默认停用，继承广告位关联） |
| DELETE | `/api/ads/admin/ad/:id` | 删除素材及其关联 |
| POST | `/api/ads/admin/slot/:slot` | 更新广告位配置 |
| POST | `/api/ads/admin/slot/:slot/links` | **整体替换**该广告位素材列表与顺序，入参 `{ adIds: [1,2,3] }` |

新建素材请求体：

```json
{
  "name": "左侧-新品卡片",
  "type": "html",
  "html": "<a href=\"...\" style=\"...\">...</a>",
  "image": "",
  "url": "",
  "enabled": true,
  "weight": 10,
  "startAt": "2026-10-29T00:00:00.000Z",
  "endAt": null,
  "slots": ["left"]
}
```

广告位配置请求体（可只传部分字段）：

```json
{ "enabled": true, "mode": "weighted", "maxCount": 2, "minGap": 4 }
```

注意：
- 更新素材是**全量覆盖**，`slots` 不传等于清空关联；先 `GET /api/ads/admin` 回读原值再改
- `weight` 自动夹到 0–1000，非法值回落 10；`maxCount` 夹到 1–5；`minGap` 夹到 1–20
- `startAt` / `endAt` 传 `null` 或空串表示不限
- `POST /slot/:slot/links` 会替换整个列表，执行前记录旧 `adIds` 以便回滚
- 所有写操作会自动失效 `ads:public` 缓存，刷新即生效

### 7.8 前台展示逻辑

- 侧栏每次页面加载选 1 条，同一次挂载内固定，不闪烁
- 正文按 `max_count` 选 N 条不重复广告，在**空行**边界把正文切成 N+1 段
- 切点避开：代码围栏内部、标题、表格、图片、列表、引用
- 相邻广告至少间隔 `min_gap` 个段落，且保证文末保留一段（约 ≥120 字符）
- 可用切点不足时宁可少插或不插，不破坏排版

### 7.9 典型任务

**新增左侧广告**：`preview` 校验 → `POST /ad` 带 `slots:["left"]` → 刷新前台确认。

**正文改为每篇 2 条**：新建素材（`slots:["inline"]`）→ `POST /slot/inline/links` 传新 id 数组 → `POST /slot/inline` 设 `{"maxCount":2,"minGap":4}` → 旧素材停用或删除。

**临时下线**：`POST /ad/:id` 传 `enabled:false`（保留素材）；整体关闭广告位用 `POST /slot/:slot` 传 `enabled:false`。

**限时投放**：设置 `startAt` / `endAt`，到期自动失效。

**轮播**：同一广告位关联多条素材，`mode=weighted` 并调整 `weight`；或 `fixed` 按顺序取第一条。

### 7.10 常见失败

| 现象 | 原因 |
|---|---|
| 保存报「HTML 为空或包含不被允许的内容」 | 含 `<script>`、`onclick`、`position`、`javascript:` 等 |
| 已启用但前台看不到 | 未关联广告位 / 广告位停用 / 不在投放时间段 / 净化后为空 |
| 前台样式变丑 | 用了 `class`（已丢弃），应改用行内 `style` |
| 正文没有广告 | 文章过短、切点不足，或素材净化后为空 |
| 修改后没变化 | 浏览器/CDN 缓存（服务端缓存已自动失效） |
| 更新后广告位关联丢失 | 更新接口全量覆盖，`slots` 未传 |

### 7.11 硬性约束

1. 不改前端代码、不改数据库结构、不新增广告位 key，只走 `/api/ads/admin/*`
2. HTML 一律行内 `style`，禁止 `class`、`position`、`z-index`、事件属性、脚本
3. 保存前先 `preview`，保存后 `GET /api/ads/admin` 回读校验 `slots` 与 `enabled`
4. `/slot/:slot/links` 是整体替换，先 GET 再改
5. 删除不可恢复，优先 `enabled:false`
6. 素材名写清位置与活动，如「左侧-Geonix-10月」
7. 一次只改一个变量，改完验证再继续