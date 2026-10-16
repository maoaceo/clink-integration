# 原生多桌面自动开机修复

区域连接前先以正确的 desktopIds JSON 数组读取实时 state。仅 SHUTOFF 发送一次 operate=1，SUSPENDED/PAUSED/HIBERNATED 发送一次operate=18；ACTIVE 不发电源请求；TASKRUNING、runningTask 或未知状态只等待。只有 ACTIVE 且无任务时申请连接参数。

账号 autoBoot=false、单台 autoBootEnabled=false、账号/桌面保活关闭、manualShutdown=true、任务被取消时不自动拉起。每桌面180秒冷却，与父账号 manager 共享；网络结果不确定也先记录冷却，禁止立即重放。这里“请求受理”不等于“已开机”，以之后实时状态确认。

自动操作使用服务端给出的官方区域节点，不调用上游盲目1/18/连接三重重试。启动状态有界等待，超时由manager退避重试。

已在 Ubuntu24.04 新服务器部署：power_guard.test.js 与 account_manager.test.js 通过。没有为了测试而关闭用户在线机器。关机/休眠开机分支仅模拟验证，真实关机后自动启动仍待自然场景或用户明确要求测试。已运行桌面重连状态检查另见本次操作结果。

此补丁没有自动升级旧服务器。通过git更新后需要重启服务，连接会短暂断开；先备份生产文件，勿把源码里的示例.env当作真实凭据。
