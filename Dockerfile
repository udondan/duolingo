# Expects a compiled dist/ next to it: `mise run docker-build` builds it first.
# TypeScript and the rest of the dev tooling stay out of the Docker build.
FROM node:26-alpine

LABEL com.docker.desktop.mcp="true"
LABEL com.docker.desktop.mcp.name="duolingo"

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY dist/ dist/

# npm and corepack aren't needed at runtime, and their bundled dependencies
# show up in vulnerability scans. apk upgrade pulls fixes for Alpine packages
# released after the base image.
RUN apk upgrade --no-cache \
    && rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
       /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack \
       /root/.npm

USER node

# `docker run udondan/duolingo <command>` runs the CLI; without a command the
# image starts the MCP server, which is what the Docker MCP Toolkit expects.
ENTRYPOINT ["node", "/app/dist/cli.js"]
CMD ["mcp"]
