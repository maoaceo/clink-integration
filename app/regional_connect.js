'use strict';
async function regionalConnect(client,desktopId){
 if(String(client.loginInfo?.deviceType||client.deviceType)==='60')throw Error('原 Web 登录态需重新扫码授权 Linux 终端');
 const id=String(desktopId);
 const base='https://desk.ctyun.cn:8810';
 const listResponse=await fetch(base+'/api/desktop/client/pageDesktop',{method:'POST',headers:client.getSignedHeaders({'Content-Type':'application/json'}),body:JSON.stringify({getCnt:50,desktopTypes:['1','2001','2002','2003'],sortType:'createTimeV1'}),signal:AbortSignal.timeout(15000)});
 const list=await listResponse.json();if(list.code!==0)throw Error('区域路由查询失败 code='+list.code);
 const all=[...(list.data?.desktopList||[]),...(list.data?.desktopPoolList||[]),...(list.data?.preemptionDesktopList||[])];
 const desktop=all.find(d=>String(d.desktopId||d.objId)===id);if(!desktop)throw Error('未找到本账号桌面路由');
 const routes=[...(desktop.connectUrl||[]),...(desktop.backupurl||[])];
 const route=routes.find(x=>{try{const u=new URL(x);return u.protocol==='https:'&&u.hostname.endsWith('.ctyun.cn')&&['8810','443',''].includes(u.port)&&!u.username&&!u.password;}catch{return false;}});
 if(!route)throw Error('桌面未返回可用官方区域地址');
 const host=new URL(route).origin;
 const common={objId:id,objType:String(desktop.objType??0),osType:'11',deviceType:client.deviceType,deviceId:'11',deviceCode:client.account.deviceCode,deviceName:'Chrome浏览器',deviceModel:'Windows NT 10.0; Win64; x64',clientVersion:client.version,appVersion:'3.2.0',sysVersion:'Windows NT 10.0; Win64; x64',specifiedCertCategory:'0'};
 async function request(path,data,post){
  const response=await fetch(host+path+(post?'':'?'+new URLSearchParams(data)),{method:post?'POST':'GET',headers:client.getSignedHeaders(post?{'Content-Type':'application/x-www-form-urlencoded'}:{}),body:post?new URLSearchParams(data).toString():undefined,signal:AbortSignal.timeout(20000)});
  const j=await response.json();if(j.code!==0)throw Error('区域连接接口拒绝 code='+j.code);return j.data||{};
 }
 let data=await request('/api/desktop/client/connectMaster',common,true);
 const deadline=Date.now()+120000;
 let nextConnectAllowed=0;
 while((data.goingRetry||!data.desktopInfo?.clinkLvsOutHost)&&Date.now()<deadline){
  if(!client.workerRunning&&client._nativeRequireWorker)throw Error('用户已停止连接');
  client.metrics.status='booting';client.account.stats=client.account.stats||{};client.account.stats.keepAliveStatus='booting';
  await new Promise(r=>setTimeout(r,5000));
  const state=await request('/api/desktop/client/state',{desktopIds:JSON.stringify([{objId:id,objType:String(desktop.objType??0)}])},false);
  const own=Array.isArray(state)?state.find(x=>String(x.desktopId||x.objId)===id):null;
  if(own?.desktopState==='ACTIVE'&&Date.now()>=nextConnectAllowed){
   // Same flow observed in the user's boot capture: ACTIVE then connectMaster again.
   data=await request('/api/desktop/client/connectMaster',common,true);
   nextConnectAllowed=Date.now()+15000;
  }else if(data.pollingKey){
   const polled=await request('/api/desktop/client/statusMaster',{...common,desktopId:data.desktopId||id,pollingKey:data.pollingKey},false);
   data={...polled,pollingKey:polled.pollingKey||data.pollingKey,desktopId:polled.desktopId||data.desktopId};
  }
 }
 if(data.goingRetry||!data.desktopInfo?.clinkLvsOutHost)throw Error('区域启动或证书尚未就绪');
 if(String(data.desktopInfo.clinkLvsOutHost).endsWith(':9011'))throw Error('服务端仍分配 Web 网关，拒绝交给原生 Clink');
 client.metrics.connectionBackend='official-clink';client.metrics.regionHost=new URL(host).hostname;
 return data.desktopInfo;
}
module.exports={regionalConnect};
