FROM node:24-bookworm-slim
WORKDIR /app
COPY --chown=node:node package.json server.js ./
COPY --chown=node:node src ./src
COPY --chown=node:node public ./public
COPY --chown=node:node scripts ./scripts
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups
USER node
ENV NODE_ENV=production HOST=0.0.0.0 PORT=4317 DATABASE_PATH=/app/data/museum.sqlite
EXPOSE 4317
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD node -e "fetch('http://127.0.0.1:4317/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node", "server.js"]
