FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install
RUN npm install --save-dev @types/needle

COPY . .

# Fix TypeScript dependency noise
RUN node -e "const fs=require('fs'); const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p)); j.compilerOptions ||= {}; j.compilerOptions.skipLibCheck = true; fs.writeFileSync(p, JSON.stringify(j, null, 2));"

# Fix duck-duck-scrape v2 typing mismatch in this repo
RUN sed -i 's/search(query, { count })/search(query)/' src/index.ts
RUN sed -i 's/r\.snippet || ""/(r as any).description || ""/' src/index.ts

RUN npm run build


FROM node:22-alpine AS runtime

WORKDIR /app
ENV NODE_ENV=production

COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "dist/index.js"]
