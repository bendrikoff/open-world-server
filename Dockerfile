FROM node:20-alpine
RUN apk add --no-cache git
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=2567

COPY package.json package-lock.json* ./
RUN npm install --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

EXPOSE 2567
CMD ["npx", "tsx", "src/index.ts"]
