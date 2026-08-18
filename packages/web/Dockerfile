FROM node:20-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY packages/web/package*.json ./packages/web/

RUN npm install --workspace=packages/web

COPY packages/web ./packages/web
RUN npm run build --workspace=packages/web

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/packages/web/.next ./packages/web/.next
COPY --from=builder /app/packages/web/public ./packages/web/public
COPY --from=builder /app/packages/web/package*.json ./packages/web/
COPY --from=builder /app/node_modules ./node_modules

EXPOSE 3000
CMD ["npm", "run", "start", "--workspace=packages/web"]
