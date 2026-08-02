FROM node:20-alpine AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml* pnpm-workspace.yaml package.json ./
COPY apps/api/package.json apps/api/package.json
COPY packages/types/package.json packages/types/package.json
RUN pnpm install --frozen-lockfile

FROM deps AS build
COPY . .
RUN pnpm --filter @finance/api exec prisma generate
RUN pnpm --filter @finance/api build

FROM base AS runner
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 3333
CMD ["node", "apps/api/dist/server.js"]
