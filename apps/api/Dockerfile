FROM node:20-slim

WORKDIR /repo
COPY . .

RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @assaan/api build

WORKDIR /repo/apps/api
ENV NODE_ENV=production
EXPOSE 8080
CMD ["node", "dist/server.js"]
