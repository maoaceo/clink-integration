# Linux 运行资源已补齐

## 包含的文件

resources/amd64 和 resources/arm64 中包含用户提供的原版官方 .deb 的分片（每片40MiB以下），没有修改安装包。manifest.json 记录各分片及完整包的 SHA-256。官方程序权利归原厂，本仓库适配代码不改变其许可；如无分发权应删除资源并从官方渠道获取。

- amd64：4.1.0.1346，175861258字节，已在 Debian13 x86-64 真实连接测试。
- arm64：4.1.0.1347，168259844字节，已在 ARM64 Debian 真实连接测试。
- 官方桌面运行目录约395MB。依赖来自 Debian 软件源，Node依赖由锁文件安装，不把系统根文件系统、node_modules上传。
- Windows客户端只做过静态分析、未完成运行适配，不作为可用Windows版本发布。
- 两架构原始包重组和SHA-256校验已在本机通过。容器已完成双架构GitHub构建/smoke，amd64国内服务器已验证管理接口、二维码生成及原生回调；具体账号握手仍需在目标环境检查。

## 宿主 Debian13 部署

```sh
sh scripts/install_dependencies.sh
python3 scripts/prepare_runtime.py --dest "$PWD/runtime"
npm ci --omit=dev --ignore-scripts
export CTYUN_NATIVE_DIR="$PWD/runtime/opt/ctg/CtyunClouddeskPublic"
export CTYUN_NATIVE_STATE="$HOME/.local/state/ctyun-clink/native"
export CTYUN_DATA_DIR="$HOME/.local/state/ctyun-clink/data"
export CTYUN_BOOTSTRAP_PASSWORD='替换为唯一强密码'
export HOST=127.0.0.1 PORT=8571 CTYUN_NATIVE_PERSISTENT=1 CTYUN_TEST_KEEPALIVE_ONLY=1
node server.js
```

依赖脚本需root；运行服务建议用专用低权限账号。`prepare_runtime.py`只解包，不执行原厂安装维护脚本。运行目录不要放在Android共享存储，可能存在noexec/权限限制。ARM64当前worker也使用Xvfb/xcb路径，此组合仍需在目标主机复验；原先ARM64实测为offscreen。

然后浏览器通过本机或SSH隧道访问8571，admin使用你设置的初始密码。扫码绑定Linux终端类型11；本发布后台主要面向x86-64，不能把架构选对误当成登录身份已跨平台验证。

## Docker

优先阅读 DOCKER-DEPLOY.md。先创建不入库的 .env，设置 CTYUN_BOOTSTRAP_PASSWORD=唯一强密码，然后 `docker compose up -d`（拉取已发布镜像）；源码构建使用 `docker compose -f docker-compose.build.yml up -d --build`。默认只映射127.0.0.1，数据使用命名卷。Node镜像、apt和npm仍需联网获取；这不是完全断网离线安装包。没有内置个人账号或默认通用密码。

## 不会上传的内容

服务器SSH密码、用户设备账号、账号secretKey、会话token、证书私钥、SSH私钥、生产.env、日志和数据库不属于运行资源，必须排除。移动公众平台上游附带的签名材料也不在本分支；当前目标为天翼Clink，不保证另外平台开箱即用。
