FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@10.33.3 --activate
WORKDIR /repo
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY apps/api/package.json apps/api/package.json
COPY apps/web/package.json apps/web/package.json
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter @captura7/web build

FROM nginx:1.27-alpine
RUN apk add --no-cache openssl
COPY infra/docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY infra/docker/entrypoint-web.sh /entrypoint-web.sh
RUN chmod +x /entrypoint-web.sh
COPY --from=build /repo/apps/web/dist /usr/share/nginx/html
EXPOSE 80 443
CMD ["/entrypoint-web.sh"]
