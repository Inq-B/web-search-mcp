#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ToolSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { search, SearchResult } from "duck-duck-scrape";
import * as cheerio from "cheerio";
import { createHash } from "crypto";

// --- Simple cache ---
const cache = new Map<string, { data: string; ts: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function getCached(key: string): string | null {
  const entry = cache.get(key);
  if (entry && Date.now() - entry.ts < CACHE_TTL) return entry.data;
  cache.delete(key);
  return null;
}

function setCache(key: string, data: string) {
  const hash = createHash("sha256").update(key).digest("hex").slice(0, 16);
  cache.set(hash, { data, ts: Date.now() });
}

// --- Content extraction ---
function extractContent(html: string, url: string): string {
  const $ = cheerio.load(html);
  $("script, style, nav, footer, header, iframe, noscript").remove();
  
  const title = $("title").text().trim();
  const body = $("body").text().trim();
  
  // Remove excessive whitespace
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
      description: "Search the web using DuckDuckGo. Returns up to 10 results with titles, URLs, and snippets.",
      inputSchema: {
        type: "object",
        properties: {
          query: { type: "string", description: "The search query" },
          count: { type: "number", description: "Number of results (1-10)", default: 5 },
        },
        required: ["query"],
      },
    },
    {
      name: "web_fetch",
      description: "Fetch a URL and extract its readable content. Best for documentation, articles, and reference pages.",
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
      const searchResults = await search(query, { count });
      const results = searchResults.results.slice(0, count);
      
      let output = `Search results for: "${query}"\n\n`;
      results.forEach((r: SearchResult, i: number) => {
        output += `${i + 1}. ${r.title}\n   URL: ${r.url}\n   ${r.snippet || ""}\n\n`;
      });
      output += `---\nResults: ${results.length}`;

      setCache(`search:${query}:${count}`, output);
      return { content: [{ type: "text", text: output }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Search error: ${err.message}` }] };
    }
  }

  if (name === "web_fetch") {
    const url = args?.url as string;

    const cached = getCached(`fetch:${url}`);
    if (cached) return { content: [{ type: "text", text: cached }] };

    try {
      const response = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (compatible; MCP-Web-Search/1.0)",
        },
        signal: AbortSignal.timeout(10000),
      });
      
      if (!response.ok) {
        return { content: [{ type: "text", text: `HTTP ${response.status}: ${response.statusText}` }] };
      }

      const html = await response.text();
      const content = extractContent(html, url);

      setCache(`fetch:${url}`, content);
      return { content: [{ type: "text", text: content }] };
    } catch (err: any) {
      return { content: [{ type: "text", text: `Fetch error: ${err.message}` }] };
    }
  }

  throw new Error(`Unknown tool: ${name}`);
});

// --- Start ---
const transport = new StdioServerTransport();
await server.connect(transport);
console.error("Web Search MCP Server running on stdio");
