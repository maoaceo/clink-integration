# Docker 部署教程

## 1. 镜像与要求

推荐镜像（Docker 自动选择 CPU 架构）：

```text
lusean23/clink-integration:latest
```

备用：`ghcr.io/maoaceo/clink-integration:latest`。支持 `linux/amd64`、`linux/arm64`，不支持 Windows 容器。无需在宿主机安装天翼客户端、Node.js、Python 或 Xvfb，官方 Linux 运行文件已包含在镜像里；宿主机只需 Docker，Compose 方式还需 Compose 插件。

- 建议单机至少 2 GB 内存，并保留 3 GB 以上磁盘空间用于下载、解包和日志。
- 镜像不是原协议版的几十 MB 轻量镜像：已部署 amd64 镜像本地大小约 1.05 GiB。
- 实际一账号两桌面场景观察到容器约 244 MiB、CPU约1.47%，仅为当时采样，不保证固定占用。
- 代码上限为每账号5台；真实场景验证过4账号5桌面、同账号2桌面。每账号5并发并未全部压测。
- ARM64镜像已构建及容器smoke通过，真实Docker账号连接以目标环境测试为准。

## 2. 最快部署（Docker CLI）

```sh
mkdir -p ~/ctyun-clink
cd ~/ctyun-clink
umask 077
# 有 openssl 时生成随机初始管理员密码；命令不会把密码印到终端
printf 'CTYUN_BOOTSTRAP_PASSWORD=%s\nTZ=Asia/Shanghai\n' "$(openssl rand -hex 24)" > .env
chmod 600 .env

docker pull lusean23/clink-integration:latest
docker volume create ctyun-clink-data

docker run -d \
  --name ctyun-clink \
  --restart unless-stopped \
  --shm-size=256m \
  --log-opt max-size=10m --log-opt max-file=3 \
  -p 127.0.0.1:8571:8571 \
  --env-file .env \
  -v ctyun-clink-data:/app/data \
  lusean23/clink-integration:latest
```

默认只允许服务器本机访问。通过 SSH 隧道：

```sh
ssh -N -L 8571:127.0.0.1:8571 用户名@服务器IP
```

浏览器打开 `http://127.0.0.1:8571`。用户名 `admin`，初始密码在当前目录 `.env` 的 `CTYUN_BOOTSTRAP_PASSWORD` 中：

```sh
sed -n 's/^CTYUN_BOOTSTRAP_PASSWORD=//p' .env
```

**没有通用默认密码。** 首次创建管理员时使用环境变量；数据卷已有管理员后，修改环境变量不会重置密码。登录后可在后台修改。

### 需要直接从公网访问

新建容器时将端口参数替换为：

```sh
-p 8571:8571
```

之后访问 `http://服务器IP:8571`。云控制台安全组/防火墙也要放行入站TCP8571，建议仅允许自己的源IP。不需要给容器 `--privileged`，不需要host网络或映射X/VNC端口。

直接暴露HTTP会明文传输管理员密码和会话，**正式使用应配置HTTPS反向代理**，不要公开生产凭据。若容器已存在，端口映射不能原地修改；保留数据卷，停止并重建容器再更改映射。

## 3. Compose 部署

下载仓库根目录 `docker-compose.yml` 或复制到工作目录，先按第2节生成 `.env`，然后：

```sh
docker compose pull
docker compose up -d
docker compose logs --tail=80 -f
```

仓库 Compose 默认使用已发布镜像，不需要克隆约328MiB的官方资源分片。如果要源码构建，使用 `docker compose -f docker-compose.build.yml up -d --build`；这会下载基础镜像、apt和npm依赖，不是离线构建。

Compose 卷与CLI卷名称可能不同（默认带项目名前缀）。从CLI迁移时不要直接换一种启动方式并误建空卷；先 `docker inspect` 核对 `/app/data` 的卷名，必要时把Compose的卷配置为对应的 `external` 卷。

## 4. 添加账号与运行状态

1. 在后台选择天翼账号扫码登录。
2. 使用官方App扫码确认。当前扫码申请的是Linux终端身份；旧Web类型60的身份可能返回HTTP网关，须重新扫码，不要随意改端口冒充Clink。
3. 打开账号保活与需要连接的桌面开关，按需开启自动开机。
4. 状态以每台 `Clink: 已连接` 和后端SDK连接事件为准，不只看“开关已开启”或云电脑“运行中”。

默认持续连接，不按60秒周期断开。后台按账号顺序申请各台新参数并连接，每桌面独立会话；断线有退避，不保证永不掉线。同一台云电脑被其他客户端使用时可能抢占，不继承原Web旁观者模式的防顶号保证。

自动开机修复已包含：先查实时状态，关机/休眠才发电源请求，启动中/任务中只等待；尊重单台与账号开关及手动关机标记，电源操作有180秒冷却。关机分支模拟验证通过，不为验证而主动关掉用户机器。

## 5. 日志、资源与停止

```sh
docker ps --filter name=ctyun-clink
docker logs --tail=100 -f ctyun-clink
docker stats --no-stream ctyun-clink
docker inspect ctyun-clink --format '{{.State.Status}} restarts={{.RestartCount}}'

# 停止所有本容器管理的连接
docker stop ctyun-clink
# 恢复
docker start ctyun-clink
```

应用的保活事件主要写到数据目录的 `logs/`，并通过Web日志页面展示；`docker logs` 未逐条输出所有事件不代表没有连接。查看数据目录文件名：

```sh
docker exec ctyun-clink sh -c 'ls -lh /app/data/logs/'
```

日志、配置和数据库可能含隐私，不要原样发GitHub。对外只提供脱敏错误码、桌面匿名标识和连接事件。

## 6. 更新与数据保护

CLI部署（原容器的端口、env文件和卷要保持一致）：

```sh
docker pull lusean23/clink-integration:latest
docker stop ctyun-clink
docker rm ctyun-clink
# 再执行第2节 docker run，使用同一个 ctyun-clink-data 卷和 .env
```

Compose部署：`docker compose pull && docker compose up -d`。

更新会短暂断线。升级前备份数据卷；不要执行 `docker compose down -v` 或 `docker volume rm`，否则会删除账号与登录状态。初始化后的管理员凭据、云账号登录态和加密主密钥保存在数据卷，备份应加密并限制权限。

## 7. 国内网络与代理

- 拉取慢不代表程序无法连接天翼。先检测Docker Hub/GHCR连通性。
- 不在仓库内置未知第三方加速站，不关闭TLS验证。若使用加速站，先从官方仓库核对manifest摘要，再按摘要拉取。
- SOCKS代理可以仅用于拉镜像，不必把天翼登录流量也代理出去。
- shell里的 `HTTPS_PROXY` 不会自动传给正在运行的dockerd；改Docker守护进程代理通常需要重启，会影响其他容器，务必确认再做。
- 也可用skopeo经可信代理获取官方镜像后导入本机Docker；不同版本对SOCKS/DNS支持有差异。脚本和代理地址不应硬编码个人信息。
- 既不方便拉取又不希望修改dockerd时，在联网机器 `docker save` 后安全传输，目标 `docker load`；先核对镜像摘要与文件SHA256。

## 8. 常见问题

- **端口不通**：核对 `docker ps` 映射，服务器本机 `curl http://127.0.0.1:8571/`，再检查云安全组与宿主防火墙。容器正常不等于公网已放行。
- **二维码生成成功但未连接**：用户需在App确认；检查登录态是否过期、区域接口与原生状态码。
- **Permission denied 数据目录**：镜像使用非root `node` 用户（UID通常1000），绑定宿主目录必须给正确写权限；不要直接chmod777。命名卷为推荐方式。
- **InitEnv failed**：运行必须带官方 `-subapp`，多实例各用独立会话目录；当前worker已处理。
- **只有一个桌面在线**：核对各台保活开关、账号登录态和真实错误码，别把开关或云端电源状态当作连接成功。
- **镜像拉取 denied**：Docker Hub仓库或GHCR package可能需要权限；登录你有权访问的账号，Token不要贴在公开日志里。
