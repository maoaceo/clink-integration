> 最新版本已合并 Web 多桌面管理，原独立验证服务已停止。请优先阅读 MERGED-WEB-MANAGER.md。

# Dashboard + 官方 Clink 测试部署

本构建基于用户提供的 ctyun-dashboard-main.zip，不是上游正式发行版。

## 部署位置

- 应用：/opt/ctyun-clink/app
- 官方 x86-64 runtime：/opt/ctyun-clink/runtime（链接到已验证 runtime）
- 数据：/var/lib/ctyun-clink，专用用户 ctyunclink
- 管理服务：ctyun-clink-test.service
- 监听：127.0.0.1:8571，仅服务器本机
- 随机管理员初始密码：服务器 /etc/ctyun-clink-test.env 中 CTYUN_BOOTSTRAP_PASSWORD；600 权限。不随本包分发。
- 停止：systemctl stop ctyun-clink-test
- 查询：systemctl status ctyun-clink-test
- 测试服务没有设置 enable 开机启动。

## 访问

从有 SSH 的电脑建立本地端口转发：

```sh
ssh -N -L 8571:127.0.0.1:8571 root@YOUR_SERVER_IP
```

然后访问 http://127.0.0.1:8571。SSH 密码不会写入本包。用户名 admin，随机密码由服务器 Root 查询：

```sh
sed -n 's/^CTYUN_BOOTSTRAP_PASSWORD=//p' /etc/ctyun-clink-test.env
```

不建议将测试构建直接绑定 0.0.0.0；公网访问需后续 HTTPS、强管理员凭据、限速、审计和更完整安全审阅。

## 已修改

- 默认官方 Clink 后端，原 WebSocket 仅显式 legacy 环境变量才启用。
- native worker 独立进程，认证配置仅通过 stdin，不放命令行。
- x86-64 使用 Xvfb + xcb；不监听 X TCP，不提供 VNC。
- 完整 savedLoginInfo 使用现有 AES-GCM 加密持久化。
- 默认随机管理员初始密码，关闭测试环境公众注册。
- 禁止 /desktop-view、/web-launch、配置导出；JSON 响应去除密码、账号密钥、完整 savedLoginInfo 和证书字段。
- 服务以非 root 专用账号运行，开启 NoNewPrivileges、只读系统目录、临时目录隔离、私有数据目录权限。

## 已知未完成

- 官方二维码生成测试成功，但用户尚未扫码确认；扫码后的 Web 身份证书能否直接建立原生 Clink 会话，必须实测。
- 上游回归并非全部通过，结果见测试记录；禁止将局部 smoke 成功等同于全部功能完成。
- 原项目密码哈希仍为固定盐 SHA256，后续应迁移为 scrypt/Argon2；仅本机测试不等于完整安全加固。
- 无画面主通道是占用型原生连接，不继承原 WebSocket 旁观者“不顶号”保证。
- 连接调度沿用上游周期语义；本测试部署尚未实现完整多节点代理注册及断线无限重连。
- 不证明挂机积分或活跃任务达标，不自动进行购买、兑换等有费用/权益影响的操作。
