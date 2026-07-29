# Container image for the Form.io MCP server (stdio transport).
#
# Build context is this directory, not the repo root — the package is
# self-contained (its tsconfig extends nothing above it and none of its
# dependencies are workspace packages), so it compiles without the monorepo.
#
# Authentication note: the browser portal-login flow cannot work inside a
# container. It binds an ephemeral port on 127.0.0.1 and shells out to
# open/xdg-open, none of which reach the host. Set FORMIO_API_KEY when running
# this image.

FROM node:22-alpine AS builder
WORKDIR /app
COPY package.json tsconfig.json tsconfig.build.json ./
RUN npm install --ignore-scripts --no-audit --no-fund
COPY src ./src
RUN npx tsc -p tsconfig.build.json

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts --no-audit --no-fund \
  && npm cache clean --force
COPY --from=builder /app/dist ./dist

# stdio transport: the MCP client owns stdin/stdout, so nothing is logged there.
ENTRYPOINT ["node", "dist/stdio.js"]
