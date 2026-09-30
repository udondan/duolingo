FROM node:lts-alpine AS builder

WORKDIR /build
COPY package*.json ./
RUN npm ci --ignore-scripts

COPY tsconfig.json .
COPY src/ src/
RUN npm run build


FROM node:lts-alpine

LABEL com.docker.desktop.mcp="true"
LABEL com.docker.desktop.mcp.name="duolingo-mcp"

WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev --ignore-scripts

COPY --from=builder /build/dist ./dist

CMD ["node", "dist/server.js"]
