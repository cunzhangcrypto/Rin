![Cover](./docs/docs/public/rin-logo.png)

English | [简体中文](./README_zh_CN.md)

![GitHub commit activity](https://img.shields.io/github/commit-activity/w/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub top language](https://img.shields.io/github/languages/top/cunzhangcrypto/Rin?style=for-the-badge)
![GitHub License](https://img.shields.io/github/license/cunzhangcrypto/Rin?style=for-the-badge)

## Web3 村长博客

A personal blog built on the Rin framework, deployed on Cloudflare — no server management required.

> This fork has Adsterra ads integrated. To use your own Adsterra account, replace the keys in the code.

**Blog:** [https://www.cunzhangblog.com](https://www.cunzhangblog.com)

## About

A modern serverless blog system built on Cloudflare's developer platform:
- **Pages** — Frontend hosting
- **Workers** — Backend services
- **D1** — SQLite database
- **R2** — Object storage

## Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/cunzhangcrypto/Rin.git && cd Rin

# 2. Install dependencies
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edit .env.local with your own configuration

# 4. Start the development server
bun run dev
```

Visit http://localhost:5173 to start hacking!

### Testing

```bash
# Run all tests
bun run test

# Run server tests only
bun run test:server

# Run tests with coverage
bun run test:coverage
```

### Deployment

```bash
# Deploy everything (frontend + backend)
bun run deploy

# Deploy only backend
bun run deploy:server

# Deploy only frontend
bun run deploy:client
```

### Acknowledgements

This project is a fork of [openRin/Rin](https://github.com/openRin/Rin). Thanks to the original author for the open-source contribution.
- Original repo: https://github.com/openRin/Rin
- Original demo: https://xeu.life

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
