![封面](./docs/docs/public/rin-logo.png)

[English](./README.md) | 简体中文

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/cunzhangcrypto/Rin?style=for-the-badge)

## Web3 村长博客

基于 Rin 框架搭建的个人博客系统，部署在 Cloudflare 上，无需管理服务器。

> 本版本已集成 Adsterra 广告，如需使用自己的 Adsterra 账号，替换代码中对应的 key 即可。

**博客地址：** [https://www.cunzhangblog.com](https://www.cunzhangblog.com)

## 项目简介

基于 Cloudflare 开发者平台构建的现代化无服务器博客系统：
- **Pages** — 前端托管
- **Workers** — 后端服务
- **D1** — SQLite 数据库
- **R2** — 对象存储

## 快速开始

```bash
# 1. 克隆仓库
git clone https://github.com/cunzhangcrypto/Rin.git && cd Rin

# 2. 安装依赖
bun install

# 3. 配置环境变量
cp .env.example .env.local
# 编辑 .env.local 填入你的配置信息

# 4. 启动开发服务器
bun run dev
```

访问 http://localhost:5173 开始开发！

### 测试

```bash
# 运行所有测试
bun run test

# 仅运行服务器测试
bun run test:server

# 运行测试并输出覆盖率
bun run test:coverage
```

### 部署

```bash
# 一键部署前后端
bun run deploy

# 仅部署后端
bun run deploy:server

# 仅部署前端
bun run deploy:client
```
### 致谢

本项目基于 [openRin/Rin](https://github.com/openRin/Rin) 二次开发，感谢原作者的开源贡献。
- 原项目地址：https://github.com/openRin/Rin
- 原项目演示站：https://xeu.life

## License

```
MIT License

Copyright (c) 2024 Xeu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```
