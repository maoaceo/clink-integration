# Clink Integration — CtYun Dashboard

基于 [muyicn/ctyun-dashboard](https://github.com/muyicn/ctyun-dashboard) 的实验适配，使用官方 Linux 客户端原生 Clink 主通道替代天翼云 WebSocket 保活。

## 当前功能

- 官方 App 二维码登录，Linux 终端身份。
- 同账号多桌面按顺序建立连接，每桌面独立进程，账号上限 5 台。
- 真实 SDK 连接状态、单台/账号启停、断线退避、桌面 ID 去重。
- 无画面持续连接，官方 x86-64 Linux Runtime + Xvfb，不开放 VNC。

## 已验证与限制

已实测 4 账号 5 桌面同时连接（其中同账号 2 台）；每账号 5 并发仅做逻辑模拟测试。SDK 心跳未单独解码，状态通过连接事件和主通道延迟通知验证。恢复连接曾出现服务端断开，不能保证永不掉线或不抢占同桌面的其他终端。

详见 [合并说明](MERGED-WEB-MANAGER.md)、[部署测试说明](DEPLOYMENT-TEST.md) 和脱敏验证 JSON。历史报告按阶段保留，最新 merged-stability-result.json 优先。Windows 版未实测；上游 Dockerfile/Windows 启动器不能直接视为此 Clink 版本的完整部署方案。

## 安全与依赖

官方安装包及解包 Runtime **不包含在仓库**，须自行从官方来源取得；部署还需 Node.js、Python3、Xvfb 和运行库。账号数据、密码、会话令牌、证书、SSH 密钥、服务器环境文件均不入库。

上游附带的移动公众平台 credentials 文件也从本发布排除；如需该平台，使用你有权使用的材料自行配置，其附带回归可能因此不通过。本次重点是天翼 Clink，非全部云平台功能保证。

默认监听本机，正式公网部署应使用 HTTPS、强密码和访问控制；本实验版不是完整安全审计。

## 来源与许可

保留上游代码与归属说明。上游仓库根目录未见统一 LICENSE；本分支不擅自给上游代码授予新的许可，公开可见不等于可任意商用或再许可。各目录已有许可按其内容处理。
