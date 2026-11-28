# The Shardfall server image: the API, the realtime gateway and the browser game it serves (same origin).
# Build from the repository root:  docker build -f server/Dockerfile -t shardfall-server .
# Run:  docker run --env-file .env -p 8787:8787 shardfall-server        (migrations: same image, `npm run migrate`)
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN if [ -f package-lock.json ]; then npm ci --omit=dev --no-audit --no-fund; else npm install --omit=dev --no-audit --no-fund; fi && npm cache clean --force
COPY build.sh ./
COPY src ./src
COPY shared ./shared
COPY server/src ./server/src
COPY server/data ./server/data
COPY supabase ./supabase
COPY assets/audio/web ./assets/audio/web
COPY assets/music ./assets/music
COPY Shardfall_v*.html ./
USER node
EXPOSE 8787
HEALTHCHECK --interval=30s --timeout=3s CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||8787)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "--import", "tsx", "server/src/index.ts"]
