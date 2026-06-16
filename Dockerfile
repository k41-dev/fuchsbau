FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# SvelteKit analyses server modules at build time; provide placeholders (not used at runtime).
ENV DATABASE_URL=postgresql://postgres:postgres@db:5432/fuchsbau
ENV BETTER_AUTH_SECRET=build-time-placeholder-min-32-characters-long
ENV BETTER_AUTH_URL=http://localhost:3000
ENV ORIGIN=http://localhost:3000

RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

RUN addgroup -S fuchsbau && adduser -S fuchsbau -G fuchsbau

COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force

COPY --from=builder /app/build ./build
COPY --from=builder /app/drizzle ./drizzle
COPY scripts/migrate.mjs scripts/migrate.mjs
COPY scripts/docker-entrypoint.sh scripts/docker-entrypoint.sh

RUN chmod +x scripts/docker-entrypoint.sh && chown -R fuchsbau:fuchsbau /app

USER fuchsbau

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
	CMD node -e "fetch('http://127.0.0.1:3000/api/health').then((r) => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"

ENTRYPOINT ["scripts/docker-entrypoint.sh"]