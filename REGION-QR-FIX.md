# 区域路由与扫码身份修复

已上线：桌面 pageDesktop 返回的官方区域地址用于 connectMaster/statusMaster，证书类别0；按 SDK state=2/3 判定在线。旧 Web(type60)扫码身份的网关为9011，向原生 Clink 返回HTTP，原生错误36700482/invalid CLINK_MAGIC。不得猜测改端口。

新二维码申请和 tokenLogin 改用官方 Linux x86-64 type11/version204010003，原账号设置保留；旧登录态停止重复开机和连接，并显示 nativeNeedsReauth=true/离线。需要用户重新扫码授权后验证完整 native 链路。

已测试：区域接口能获取参数、新 type11 二维码能生成、服务运行、旧 type60 登录态不再报假在线。尚未测试：新 type11 用户实际扫码完成后的连接。不是已完成端到端修复的声明。
