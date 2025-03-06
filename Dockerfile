FROM node:20.17.0 AS base

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY package.json yarn.lock* ./
RUN yarn

# Build code
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN cp .env.example .env && sed -i 's|^NEXT_PUBLIC_SOCKET_URL=.*|NEXT_PUBLIC_SOCKET_URL=https://socket-sfu.ggwpdev.my.id|' .env && yarn build

FROM base AS dev
WORKDIR /app
COPY --from=builder /app/.next/ ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env .env
COPY --from=builder /app/public public
COPY --from=builder /app/package.json package.json

EXPOSE 8144

CMD ["yarn", "start:dev"]

FROM base AS prod
WORKDIR /app
COPY --from=builder /app/.next/ ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.env .env
COPY --from=builder /app/public public
COPY --from=builder /app/package.json package.json

EXPOSE 814

CMD ["yarn", "start:prod"]