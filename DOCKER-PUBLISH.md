# GitHub 自动构建镜像

工作流 .github/workflows/docker.yml 在 clink-integration/main 推送、v* 标签或手动运行时构建。

- 原生 amd64 与 arm64 GitHub runner 分别构建，不用QEMU模拟执行官方客户端。
- 核心逻辑测试、官方包SHA256校验、容器HTTP与权限拦截、原生库ldd检查。
- 两个架构均成功后发布 ghcr.io/maoaceo/clink-integration:latest 和 sha-提交前12位；版本标签另发布同名tag。
- 使用GITHUB_TOKEN的packages:write权限，不需要个人PAT。不传生产账号、密码或SSH私钥。
- 镜像smoke不包含真实账号握手，不能等同于容器内Clink端到端验证。

成功发布后使用：

```sh
docker pull ghcr.io/maoaceo/clink-integration:latest
docker run -d --name ctyun-clink --restart unless-stopped \
  --shm-size=256m -p 127.0.0.1:8571:8571 \
  --env-file /安全位置/ctyun.env \
  -v ctyun-data:/app/data \
  ghcr.io/maoaceo/clink-integration:latest
```

ctyun.env自行设置 CTYUN_BOOTSTRAP_PASSWORD=唯一强密码，不上传GitHub。公网部署通过HTTPS反向代理，不建议直接暴露无TLS登录页面。

如果拉取提示denied，需在仓库关联的Packages中把镜像Visibility设为Public，或用有read:packages权限的账号登录GHCR。SSH代码推送权限并不等于可通过API修改Package权限。

如果Actions未运行，检查仓库Actions是否启用；如果ARM runner不可用或配额不足，构建会如实失败，不会提前发布多架构latest。官方运行包版权归原厂，发布镜像前应确认你的分发使用权。
