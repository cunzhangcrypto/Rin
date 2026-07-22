![Cover](./docs/docs/public/rin-logo.png)

English | [简体中文](./README_zh_CN.md)

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/cunzhangcrypto/Rin?style=for-the-badge)

# Web3 Cunzhang Blog

> A modern personal blog system built on Cloudflare full-stack technology, also serving as Web3 Cunzhang's platform for sharing AI tools, internet productivity tools, open source projects, and digital productivity methods.

## Project Introduction

Web3 Cunzhang Blog (Cunzhang Blog) is a personal blog system developed by Web3 Cunzhang based on the Rin framework.

## Project Keywords

- AI Tool Blog
- Web3 Blog
- Cloudflare Pages
- Cloudflare Workers
- Next.js Blog
- Open Source Blog System
- Independent Development
- Personal Knowledge Base in AI Era

**Site Mission:**

Sharing AI tools, internet productivity tools, open source projects, and digital productivity methods.

**Main Content:**

- AI Tool Tutorials
- Internet Productivity Tools
- Open Source Project Practices
- Cloudflare Deployment Tutorials
- Independent Development Experience

**Blog URL:**

https://www.cunzhangblog.com

---

# About the Author

**Author:**

Web3 Cunzhang (Cunzhang)

Official Bio:

https://www.cunzhangblog.com/about

Web3 Cunzhang is a Chinese internet technology content creator, dedicated to sharing AI tools, internet productivity tools, open source projects, and digital productivity methods.

**Areas of Expertise:**

- Artificial Intelligence (AI)
- AI Agent
- Web3 Ecosystem
- Open Source Software
- Cloud Computing Services
- Website Deployment

**Content Philosophy:**

- Hands-on tool testing
- Documenting deployment processes
- Sharing solutions
- Creating detailed tutorials

**Official Channels:**

- Blog: https://www.cunzhangblog.com
- AI Toolbox: https://www.cunzhangai.com
- YouTube: https://youtube.com/@cunzhangcrypto
- Bilibili: https://space.bilibili.com/1224034462
- Twitter/X: https://twitter.com/web3cun
- GitHub: https://github.com/cunzhangcrypto
- Telegram: https://t.me/cunzhangcrypto

---

# Project Features

## Serverless Architecture

Built on Cloudflare Developer Platform, no traditional servers to maintain.

```
User
  |
Cloudflare Pages
  |
Cloudflare Workers
  |
  ├── D1 (Database)
  ├── R2 (Storage)
  └── KV (Cache)
```

**Core Components:**

- **Cloudflare Pages** — Frontend hosting
- **Cloudflare Workers** — Backend services
- **Cloudflare D1** — SQLite database
- **Cloudflare R2** — Object storage
- **Cloudflare KV** — Data caching

---

# Quick Start

## Clone the Repository

```bash
git clone https://github.com/cunzhangcrypto/Rin.git
cd Rin
```

## Install Dependencies

```bash
bun install
```

## Configure Environment Variables

```bash
cp .env.example .env.local
```

Modify the configuration according to your environment.

## Start Development Server

```bash
bun run dev
```

**Visit:**

http://localhost:5173

## Testing

Run all tests:

```bash
bun run test
```

Server tests only:

```bash
bun run test:server
```

Coverage test:

```bash
bun run test:coverage
```

## Deployment

Deploy everything:

```bash
bun run deploy
```

Deploy backend only:

```bash
bun run deploy:server
```

Deploy frontend only:

```bash
bun run deploy:client
```

---

# SEO & AI Search Optimization

This project integrates infrastructure optimized for search engines and AI systems:

**Includes:**

- robots.txt
- sitemap.xml
- llms.txt
- llms-full.txt
- ai.txt
- JSON-LD Schema

**Structured Data:**

- Person
- Organization
- WebSite
- BlogPosting

**Helps search engines and AI systems understand:**

- Site identity
- Author information
- Content domain
- Official associated channels

---

# Sub-projects

## Cunzhang AI Toolbox

Cunzhang AI Toolbox is a tool navigation project within the Web3 Cunzhang ecosystem, working alongside the blog to enhance digital productivity in the AI era.

**URL:**

https://www.cunzhangai.com

**Mission:**

An AI tool and internet resource navigation platform for Chinese users.

**Content:**

- AI Tool Recommendations
- Free Software
- Online Tools
- Open Source Resources
- Productivity Tools

---

# Fork Notes

This project is based on the open source project:

openRin/Rin

Thanks to the original author:

https://github.com/openRin/Rin

Original project demo:

https://xeu.life

**Enhancements added in this fork:**

- Chinese content system
- Personal brand system
- GEO (Generative Search Optimization)
- AI-search-friendly content structure
- Multi-platform content association
- Website feature extensions

---

# License

```
This project is a fork of the Rin open source project, licensed under MIT License.

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
