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