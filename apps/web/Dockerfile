# ─── Build Stage ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

# Copy workspace root manifests first (for npm workspaces)
COPY package.json package-lock.json ./

# Copy each workspace member's package.json (needed for npm ci)
COPY apps/web/package.json    apps/web/
COPY apps/desktop/package.json apps/desktop/
COPY packages/platform/package.json packages/platform/
COPY packages/protocol/package.json packages/protocol/

# Install all workspace deps from monorepo root (honours workspaces field)
RUN npm ci --ignore-scripts

# Copy source code needed for the web build
COPY packages/ packages/
COPY apps/desktop/src/ apps/desktop/src/
COPY apps/desktop/tsconfig.json apps/desktop/
COPY apps/desktop/tsconfig.node.json apps/desktop/
COPY apps/web/ apps/web/

# Build the web app
WORKDIR /app/apps/web
RUN npx vite build

# ─── Serve Stage ──────────────────────────────────────────────────────────────
FROM nginx:alpine
COPY apps/web/nginx.lan.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html
EXPOSE 3000
CMD ["nginx", "-g", "daemon off;"]
