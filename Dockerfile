# Multi-stage build for SaLuDo backend
FROM node:20-slim AS builder
WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci

# Copy source and build
COPY . .
RUN npm run build

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Install production dependencies only
COPY package*.json ./
RUN npm ci --omit=dev

# Copy compiled code and needed assets
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/templates ./templates
COPY --from=builder /app/templates ./dist/templates

EXPOSE 3000
CMD ["node", "dist/index.js"]
