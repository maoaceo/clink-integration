FROM node:22-trixie-slim
WORKDIR /app
COPY scripts/install_dependencies.sh /tmp/install_dependencies.sh
RUN sh /tmp/install_dependencies.sh && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY resources ./resources
COPY scripts ./scripts
RUN python3 scripts/prepare_runtime.py --dest /opt/ctyun-clink/runtime && rm -rf /app/resources /app/.runtime-cache
COPY server.js ./
COPY app ./app
ENV HOST=0.0.0.0 PORT=8571 CTYUN_DATA_DIR=/app/data CTYUN_CONNECTION_BACKEND=clink CTYUN_NATIVE_DIR=/opt/ctyun-clink/runtime/opt/ctg/CtyunClouddeskPublic CTYUN_NATIVE_STATE=/app/data/native CTYUN_NATIVE_PERSISTENT=1 CTYUN_TEST_KEEPALIVE_ONLY=1 TZ=Asia/Shanghai
RUN mkdir -p /app/data /tmp/ctyun-home && chown -R node:node /app/data /tmp/ctyun-home
ENV HOME=/tmp/ctyun-home
USER node
EXPOSE 8571
VOLUME ["/app/data"]
CMD ["node", "server.js"]
