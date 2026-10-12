# Container image for the Form.io MCP server (stdio transport).
#
# Build context is the REPOSITORY ROOT, not this directory, because that is where
# pnpm-lock.yaml lives. The image installs from that lockfile with
# --frozen-lockfile, so it carries exactly the dependency versions the repository
# tested; built from this directory alone it had no lockfile and resolved every
# range afresh at build time. Build it from the root:
#
#   docker build -f packages/mcp-server/Dockerfile -t formio-mcp .
#
# Authentication note: the browser portal-login flow cannot work inside a
# container. It binds an ephemeral port on 127.0.0.1 and shells out to
# open/xdg-open, none of which reach the host. Set FORMIO_API_KEY when running
# this image.

FROM node:22-alpine AS builder
WORKDIR /repo
# pnpm at the version the root package.json's packageManager field names.
RUN corepack enable
# The workspace manifests and the lockfile first, so the install layer is reused
# until one of them changes.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/mcp-server/package.json ./packages/mcp-server/
RUN pnpm install --frozen-lockfile --ignore-scripts --filter @formio/mcp...
COPY packages/mcp-server/tsconfig.json packages/mcp-server/tsconfig.build.json ./packages/mcp-server/
COPY packages/mcp-server/src ./packages/mcp-server/src
COPY packages/mcp-server/README.md ./packages/mcp-server/
# The licence the package's `files` names; the npm tarball gets it from prepack.
COPY LICENSE ./packages/mcp-server/
RUN pnpm --filter @formio/mcp build
# A self-contained copy of the package: its `files` plus its production
# dependencies, at the versions the shared lockfile records. pnpm 10 deploys from
# the shared lockfile only with injected workspace packages; this package depends
# on no workspace package, so the setting changes nothing else.
RUN pnpm --config.inject-workspace-packages=true deploy --filter @formio/mcp --prod /out

FROM node:22-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=builder /out ./

# stdio transport: the MCP client owns stdin/stdout, so nothing is logged there.
ENTRYPOINT ["node", "dist/stdio.js"]
