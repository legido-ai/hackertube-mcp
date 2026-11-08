# syntax=docker/dockerfile:1
FROM node:24-alpine AS deps

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts

FROM node:24-alpine AS runtime

LABEL org.opencontainers.image.title="hackertube-mcp" \
      org.opencontainers.image.description="Read-only MCP server for HackerTube, the HN-curated YouTube discovery layer" \
      org.opencontainers.image.source="https://github.com/legido-ai/hackertube-mcp" \
      org.opencontainers.image.licenses="MIT"

ENV NODE_ENV=production \
    HACKERTUBE_DATA_DIR=/data

WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY src ./src

RUN mkdir -p /data && chown -R node:node /data /app
USER node

VOLUME ["/data"]
ENTRYPOINT ["node", "src/index.js"]
