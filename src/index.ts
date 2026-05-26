#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as cheerio from "cheerio";
import { createHash } from "crypto";
import { chromium } from "playwright";

// --- Simple cache ---
const cache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000;

function getCached(key: string): string | null {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  const entry = cache.get(hash);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(hash);
  return null;
}

function setCache(key: string, data: string) {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  cache.set(hash, { data, ts: Date.now() });
}

async function chromiumSearch(query: string, count: number) {
  const browser = await chromium.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });

  try {
    const page = await browser.newPage({
      userAgent:
        "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    });

    await page.goto(
      `https://duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
      {
        waitUntil: "domcontentloaded",
        timeout: 30000,
      }
    );

    await page.waitForSelector(".result", { timeout: 15000 });

    return await page.$$eval(
      ".result",
      (nodes, count) =>
        nodes.slice(0, Number(count)).map((node) => {
          const titleEl = node.querySelector(".result__title a");
          const snippetEl = node.querySelector(".result__snippet");

          return {
            title: titleEl?.textContent?.trim() || "",
            url: (titleEl as HTMLAnchorElement | null)?.href || "",
            snippet: snippetEl?.textContent?.trim() || "",
          };
        }),
      count
    );
  } finally {
    await browser.close();
  }
}

// --- Content extraction ---
function extractContent(html: string, url: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, iframe, noscript").remove();

  const title = $("title").text().trim();
  const body = $("body").text().trim();
  const clean = body.replace(/\s+/g, " ").slice(0, 5000);

  return `URL: ${url}\nTitle: ${title}\n\n${clean}`;
}

// --- Server setup ---
const server = new Server(
  { name: "web-search-mcp", version: "1.0.0" },
  { capabilities: { tools: {} } }
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: "web_search",
      description:
        "Search the web using DuckDuckGo in headless Chromium. Returns up to 10 results with titles, URLs, and snippets.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: {
            type: "number",
            description: "Number of results (1-10)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    {
      name: "web_fetch",
      description:
        "Fetch a URL and extract its readable content. Best for documentation, articles, and reference pages.",
      inputSchema: {
        type: "object",
        properties: {
          url: { type: "string", description: "The URL to fetch" },
        },
        required: ["url"],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  if (name === "web_search") {
    const query = args?.query as string;
    const count = Math.min((args?.count as number) || 5, 10);

    const cached = getCached(`search:${query}:${count}`);
    if (cached) return { content: [{ type: "text", text: cached }] };

    try {
      const results = await chromiumSearch(query, count);

      let output = `Search results for: "${query}"\n\n`;
      results.forEach((r, i) => {
        output += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || ""}\n\n`;
      });
      output += `---\nResults: ${results.length}`;

      setCache(`search:${query}:${count}`, output);
      return { content: [{ type: "text", text: output }] };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Search error: ${err.message}` }],
      };
    }
  }

  if (name === "web_fetch") {
    const url = args?.url as string;

    const cached = getCached(`fetch:${url}`);
    if (cached) return { content: [{ type: "text", text: cached }] };

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        return {
          content: [
            { type: "text", text: `HTTP ${response.status}: ${response.statusText}` },
          ],
        };
      }

      const html = await response.text();
      const content = extractContent(html, url);

      setCache(`fetch:${url}`, content);
      return { content: [{ type: "text", text: content }] };
    } catch (err: any) {
      return {
        content: [{ type: "text", text: `Fetch error: ${err.message}` }],
      };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Web Search MCP Server running on stdio");
