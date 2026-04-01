FROM oven/bun:1.3-alpine

WORKDIR /app

COPY package.json bun.lock* ./
RUN bun install --production

COPY src/ src/
COPY drizzle.config.ts ./

EXPOSE 3001

CMD ["bun", "run", "src/index.ts"]
