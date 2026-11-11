FROM node:26-alpine AS build
RUN npm i -g pnpm@12.18.0
WORKDIR /repo
COPY . .
RUN pnpm install --frozen-lockfile --filter @app/server...
RUN pnpm --filter @app/server build
# @app/shared is bundled into dist, so it is dropped from the production tree.
RUN pnpm --filter @app/server deploy --prod --legacy /out \
    && rm -rf /out/node_modules/@app

FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /out/node_modules ./node_modules
COPY --from=build /out/package.json ./package.json
COPY --from=build /repo/apps/server/dist ./dist
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:${PORT:-3000}/healthz || exit 1
CMD ["node", "dist/index.js"]
