FROM mcr.microsoft.com/playwright:v1.49.1-noble AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm uninstall duck-duck-scrape || true
RUN npm install playwright

COPY . .

RUN node -e "const fs=require('fs'); const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p)); j.compilerOptions ||= {}; j.compilerOptions.skipLibCheck = true; fs.writeFileSync(p, JSON.stringify(j, null, 2));"

RUN npm run build


FROM mcr.microsoft.com/playwright:v1.49.1-noble AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright

COPY package*.json ./
RUN npm install --omit=dev
RUN npm uninstall duck-duck-scrape || true
RUN npm install playwright

COPY --from=builder /app/dist ./dist

CMD ["node", "dist/index.js"]
