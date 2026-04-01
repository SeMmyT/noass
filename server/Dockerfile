FROM node:22-alpine
WORKDIR /app
RUN corepack enable pnpm
COPY package.json pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile
COPY tsconfig.json ./
COPY src/ src/
EXPOSE 3333
ENV PORT=3333
CMD ["npx", "tsx", "src/index.ts"]
