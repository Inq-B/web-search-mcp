FROM node:22-alpine AS builder

WORKDIR /app

COPY package*.json ./

RUN npm install

# Fix broken upstream API mismatch
RUN npm install duck-duck-scrape@2

# Fix missing typings
RUN npm install --save-dev @types/needle

COPY . .

# Relax TS library checking for dependency typings
RUN node -e "const fs=require('fs'); const p='tsconfig.json'; const j=JSON.parse(fs.readFileSync(p)); j.compilerOptions ||= {}; j.compilerOptions.skipLibCheck = true; fs.writeFileSync(p, JSON.stringify(j, null, 2));"

RUN npm run build


FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY package*.json ./

RUN npm install
RUN npm install duck-duck-scrape@2

RUN npm cache clean --force

COPY --from=builder /app/dist ./dist

USER node

CMD ["node", "dist/index.js"]
