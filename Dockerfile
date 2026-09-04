FROM node:22-alpine AS web
WORKDIR /app/web
COPY web/package*.json ./
RUN npm install
COPY web/ ./
RUN npm run build

FROM node:22-alpine AS server
WORKDIR /app/server
COPY server/package*.json ./
RUN npm install
COPY server/ ./
RUN npm run build

FROM node:22-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY server/package*.json ./
RUN npm install --omit=dev
COPY --from=server /app/server/dist ./dist
COPY --from=web /app/web/dist ./public
EXPOSE 8080
CMD ["node", "dist/index.js"]
