# Web Search MCP Server

**DuckDuckGo search + web content extraction for AI agents.** No API key needed. Free tier works forever.

## What agents do with this

- Search the web in real-time for current information
- Fetch and extract readable content from any URL
- Ask questions, verify facts, find sources
- Browse documentation, job listings, news

## Quick Install

### Method 1: Direct from GitHub (no npm account needed)

Clone and run:

```bash
git clone https://github.com/tiagohanna123/web-search-mcp.git
cd web-search-mcp
npm install
npm run build
node dist/index.js
```

### Method 2: npx (if you have npm)

```json
{
  "mcpServers": {
    "web-search": {
      "command": "npx",
      "args": ["-y", "github:tiagohanna123/web-search-mcp"]
    }
  }
}
```

### Method 3: Docker

```bash
docker run -i --rm ghcr.io/tiagohanna123/web-search-mcp
```

## Tools

### `web_search`
Search DuckDuckGo. Returns up to 10 results with titles, URLs, and snippets.

Parameters:
- `query` (required) — The search query
- `count` (optional, default 5, max 10) — Number of results

### `web_fetch`
Fetch any URL and extract readable content (strips navigation, ads, footers).

Parameters:
- `url` (required) — The URL to fetch

## Premium — R$50 (lifetime)

Get unlimited requests and priority features:

### What's included vs Free

| Feature | Free | Premium |
|---------|------|---------|
| Requests/minute | 10 | 100 |
| Content extraction | 5K chars | 50K chars |
| Cache | 5 min | 30 min |
| Rate limit window | 1 min | Rolling 24h |
| Support | GitHub Issues | Priority channel |

### How to buy

[**Comprar Acesso Premium — R$50 via Pix ou Cartão**](https://checkout.infinitepay.io/mkblprodutora?lenc=G9kAICwObDcUIfYX1n5wdlgVNGUh4qpTDj0JKYraktDO__tTL8AB-UAZ2-xl7b-BAhSBhMYuFbTnLSiyTFuae3rgENYWtIV5awVWxOlFEz7kxbrslLcVCepThKJDv_zGBzQERFJgMOkHlu2YngEOrGAWvdbOcbtUPARm0QRt43DWiDIB7p_aLP2vpajQkYQjiTAyUeJ-9h0UmfWYX-emWVM-KUGYxFIsrNsHJGs_X6QeQlTgMur7yBQ.v1.8e658d82516df961)

After purchase, email us at mkblprodutora@infinitepay.io with your GitHub username to receive a premium access key.

### Or self-host with all features (forever free)

The code is MIT licensed. Clone the repo, run it yourself. No limits. Premium is for those who want a managed instance.

## Tech Stack

- TypeScript / Node.js
- @modelcontextprotocol/sdk
- duck-duck-scrape (DuckDuckGo API)
- cheerio (HTML parsing)
- Built-in cache (TTL 5 min)
