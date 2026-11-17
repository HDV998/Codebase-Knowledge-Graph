FROM node:22-alpine AS builder

WORKDIR /app
COPY package*.json ./
COPY services/ingestion-engine/package*.json ./services/ingestion-engine/
COPY services/api-gateway/package*.json ./services/api-gateway/
COPY packages/web/package*.json ./packages/web/

RUN npm ci --include=dev --workspace=services/ingestion-engine --workspace=services/api-gateway

COPY services/ingestion-engine ./services/ingestion-engine
COPY services/api-gateway ./services/api-gateway

RUN npm run build --workspace=services/ingestion-engine
RUN npm run build --workspace=services/api-gateway

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app ./

EXPOSE 4000
CMD ["npm", "run", "start", "--workspace=services/api-gateway"]
