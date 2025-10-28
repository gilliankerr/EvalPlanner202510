# syntax=docker/dockerfile:1

FROM node:18-bullseye-slim AS deps
WORKDIR /app

COPY package*.json ./
COPY project/package*.json project/

RUN npm ci

FROM node:18-bullseye-slim AS build
WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/project/node_modules ./project/node_modules
COPY . .

RUN npm run build

FROM node:18-bullseye-slim AS production
WORKDIR /app
ENV NODE_ENV=production
ENV npm_config_loglevel=error
ENV npm_config_fund=false
ENV npm_config_audit=false
ENV npm_config_ignore_scripts=true

# Install PostgreSQL client for database migrations
RUN apt-get update && \
    apt-get install -y postgresql-client && \
    rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY project/package*.json project/
RUN npm ci --omit=dev
ENV npm_config_ignore_scripts=false

COPY . .
COPY --from=build /app/project/dist ./project/dist

CMD ["node", "start-production.js"]
