FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @captura7/api build

FROM node:22-alpine AS runtime
WORKDIR /repo
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000
COPY infra/docker/entrypoint-api.sh /entrypoint-api.sh
USER root
RUN chmod +x /entrypoint-api.sh
USER node
CMD ["/entrypoint-api.sh"]
