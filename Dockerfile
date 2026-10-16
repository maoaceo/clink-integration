FROM node:22-trixie-slim AS runtime-extract
WORKDIR /prepare
RUN apt-get update && apt-get install -y --no-install-recommends python3 && rm -rf /var/lib/apt/lists/*
COPY resources ./resources
COPY scripts/prepare_runtime.py ./scripts/prepare_runtime.py
RUN python3 scripts/prepare_runtime.py --dest /opt/ctyun-clink/runtime

FROM node:22-trixie-slim
WORKDIR /app
COPY scripts/install_dependencies.sh /tmp/install_dependencies.sh
RUN sh /tmp/install_dependencies.sh && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY --from=runtime-extract /opt/ctyun-clink/runtime /opt/ctyun-clink/runtime
COPY server.js ./
COPY app ./app
ENV HOST=0.0.0.0 PORT=8571 CTYUN_DATA_DIR=/app/data CTYUN_CONNECTION_BACKEND=clink CTYUN_NATIVE_DIR=/opt/ctyun-clink/runtime/opt/ctg/CtyunClouddeskPublic CTYUN_NATIVE_STATE=/app/data/native CTYUN_NATIVE_PERSISTENT=1 CTYUN_TEST_KEEPALIVE_ONLY=1 TZ=Asia/Shanghai
RUN mkdir -p /app/data /tmp/ctyun-home && chown -R node:node /app/data /tmp/ctyun-home
ENV HOME=/tmp/ctyun-home
USER node
EXPOSE 8571
VOLUME ["/app/data"]
CMD ["node", "server.js"]
