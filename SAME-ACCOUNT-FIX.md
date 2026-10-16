> 最新版本已合并 Web 多桌面管理，原独立验证服务已停止。请优先阅读 MERGED-WEB-MANAGER.md。

# 同账号多桌面修复与验证

修正 regional_connect.js 的 state 查询：desktopIds 必须为 [{objId, objType}] JSON 数组，不是单个字符串 ID；修正后已实际返回 code=0。

启动等待采用实时 state + 有界 statusMaster 轮询；ACTIVE 后重新获取连接参数，避免仅依赖最初 pollingKey。

独立验证服务 ctyun-same-account-hold.service：先申请第一台参数，等其原生 state=2/3；等待5秒，再申请第二台参数；等待5秒后启动第二台。每台独立 worker、私有目录、-subapp 原生进程。第二台获取参数失败时不会强制结束第一台。

最新一轮两台均进入 state=2 并各自收到延迟通知。持续观测结果单独记录，不能用上一轮同名旧状态文件当作当前在线证据。

当前两台由独立验证服务保持。该账号 Dashboard 常规保活已暂停以避免重复连接，其他账号未停止。独立验证服务目前不由页面账号开关直接管理；停止时使用 systemctl stop ctyun-same-account-hold。多桌面调度尚未完整并入 Web 后台，不宣称每账号5台已压测。

没有重新登录或更改账号设备码；此前失败不能直接归因平台账号限制。延迟通知和state验证不等于已经抓取解析协议心跳，也不保证永不掉线。
