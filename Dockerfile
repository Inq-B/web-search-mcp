FROM mcr.microsoft.com/playwright:v1.49.1-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install playwright

COPY . .

RUN node -e "const fs=require('fs'); const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p)); j.compilerOptions ||= {}; j.compilerOptions.skipLibCheck = true; fs.writeFileSync(p, JSON.stringify(j, null, 2));"

# Patch source to use Playwright browser search instead of duck-duck-scrape
RUN node <<'EOF'
const fs = require("fs");
const p = "src/index.ts";
let s = fs.readFileSync(p, "utf8");

s = s.replace(
  /import\s+\{\s*search\s*\}\s+from\s+["']duck-duck-scrape["'];?/,
  `import { chromium } from "playwright";`
);

s = s.replace(
  /const searchResults = await search\(query, \{ count \}\);[\s\S]*?const formattedResults = searchResults\.results\.slice\(0, count\)\.map\(\(r: any\) => \(\{[\s\S]*?\}\)\);/,
  `const browser = await chromium.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-dev-shm-usage"]
      });

      const page = await browser.newPage({
        userAgent: "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36"
      });

      await page.goto("https://duckduckgo.com/html/?q=" + encodeURIComponent(query), {
        waitUntil: "domcontentloaded",
        timeout: 30000
      });

      await page.waitForSelector(".result", { timeout: 15000 });

      const formattedResults = await page.$$eval(".result", (nodes, count) =>
        nodes.slice(0, Number(count)).map((node: any) => {
          const titleEl = node.querySelector(".result__title a");
          const snippetEl = node.querySelector(".result__snippet");
          return {
            title: titleEl?.textContent?.trim() || "",
            url: titleEl?.href || "",
            snippet: snippetEl?.textContent?.trim() || ""
          };
        }),
        count
      );

      await browser.close();`
);

fs.writeFileSync(p, s);
EOF

RUN npm run build


FROM mcr.microsoft.com/playwright:v1.49.1-noble AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev
RUN npm install playwright

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
