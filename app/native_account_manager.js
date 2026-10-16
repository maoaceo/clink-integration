'use strict';
const {runNative}=require('./clink_backend');
const {regionalConnect}=require('./regional_connect');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const owners=new Map(); // process-global reservation: never duplicate one desktop across accounts.
class NativeAccountManager {
 constructor(client,log,options={}){
  this.client=client;this.log=log;this.options=options;this.sessions=new Map();this.enabled=false;this.generation=0;this.timer=null;this.busy=false;this.current=null;this.lastRefresh=0;this.failures=new Map();
 }
 valid(g){return this.enabled&&this.generation===g&&this.client.account.enabled!==false&&this.client.account.features?.keepAlive!==false&&!this.client.account.sessionExpired;}
 start(){
  this.enabled=true;this.client.workerRunning=true;
  if(!this.timer)this.timer=setInterval(()=>this.tick(),5000);
  this.tick();
 }
 stop(){
  this.enabled=false;this.generation++;this.client.workerRunning=false;clearInterval(this.timer);this.timer=null;
  if(this.current)this.current.workerRunning=false;
  for(const row of this.sessions.values()){row.stopping=true;row.peer.workerRunning=false;if(row.peer.endCurrentSession)row.peer.endCurrentSession('user_stop');}
  this.publish();
 }
 stopDesktop(id){
  const row=this.sessions.get(String(id));if(row){row.stopping=true;row.peer.workerRunning=false;if(row.peer.endCurrentSession)row.peer.endCurrentSession('desktop_disabled');}
  if(this.current&&this.current._nativeDesktopId===String(id))this.current.workerRunning=false;
  this.publish();
 }
 desired(){
  const a=this.client.account;
  const cached=this.client.desktopsCache?.length?this.client.desktopsCache:(a.desktops||[]);
  const preferences=new Map((a.desktops||[]).map(d=>[String(d.desktopId||d.objId),d]));
  const seen=new Set();return cached.filter(d=>{
   const id=String(d.desktopId||d.objId||'');if(!id||seen.has(id))return false;seen.add(id);
   return (preferences.get(id)||d).keepaliveEnabled!==false;
  }).slice(0,5);
 }
 publish(){
  const c=this.client;const views=[];let newest='';
  for(const [id,r] of this.sessions){
   const connected=!r.stopping&&r.peer.wsAlive===true;
   views.push({desktopId:id,status:connected?'online':r.stopping?'stopping':r.peer.metrics.status||'connecting',connected,connectedAt:r.connectedAt||null,lastHeartbeatTime:r.peer.metrics.lastHeartbeatTime||'',lastNativeState:r.peer.metrics.lastNativeState||'',backend:'official-clink'});
   if(connected&&r.peer.metrics.lastHeartbeatTime>newest)newest=r.peer.metrics.lastHeartbeatTime;
  }
  const online=views.filter(v=>v.connected).length;
  c.wsAlive=online>0;c.metrics.nativeSessions=views;c.metrics.nativeMaxPerAccount=5;c.metrics.nativeOnlineCount=online;c.metrics.nativeManaged=true;c.metrics.connectionBackend='official-clink';
  c.metrics.status=online?'online':this.enabled?'connecting':'offline';
  c.metrics.lastHeartbeatResult=online?`Clink ${online}/${this.desired().length} 台已连接（每账号上限5台）`:this.enabled?'等待原生会话连接':'连接已停止';
  if(newest)c.metrics.lastHeartbeatTime=newest;
  c.account.stats=c.account.stats||{};c.account.stats.keepAliveStatus=c.metrics.status;
  if(online)c.account.stats.lastError='';
 }
 async tick(){
  this.publish();if(this.busy||!this.enabled)return;
  this.busy=true;const g=this.generation;
  try{
   if(!this.valid(g)){this.stop();return;}
   if(Date.now()-this.lastRefresh>60000){await this.client.getDesktops();this.lastRefresh=Date.now();}
   if(!this.valid(g))return;
   const desired=this.desired();const allowed=new Set(desired.map(d=>String(d.desktopId||d.objId)));
   for(const id of this.sessions.keys())if(!allowed.has(id))this.stopDesktop(id);
   for(const desktop of desired){
    if(!this.valid(g))break;
    const id=String(desktop.desktopId||desktop.objId);
    if(this.sessions.has(id)||owners.has(id)||(this.failures.get(id)||0)>Date.now())continue;
    owners.set(id,this);const peer=new this.client.constructor({...this.client.account,stats:{}});
    peer.loginInfo=this.client.loginInfo;peer.deviceType=this.client.deviceType;peer.version=this.client.version;peer.workerRunning=true;peer._nativeRequireWorker=true;peer._nativeDesktopId=id;peer._nativePowerOwner=this.client;peer._nativeLog=this.log;this.current=peer;
    let row=null;
    try{
     this.log('KeepAlive',`[Clink多桌面] ${id} 排队获取参数`,'info');
     const info=await regionalConnect(peer,id);
     if(!this.valid(g)||!this.desired().some(d=>String(d.desktopId||d.objId)===id)){owners.delete(id);break;}
     // Fetch right before use; never cache certificates for all desktops first.
     await sleep(this.options.settleMs??5000);
     if(!this.valid(g)||!peer.workerRunning){owners.delete(id);break;}
     row={peer,stopping:false,ended:false,connectedAt:null};this.sessions.set(id,row);
     const resultPromise=runNative(peer,desktop,info,0,this.log);
     row.promise=resultPromise;
     resultPromise.then(result=>{
      row.ended=true;if(this.sessions.get(id)===row)this.sessions.delete(id);
      if(owners.get(id)===this)owners.delete(id);
      this.failures.set(id,Date.now()+(result.success?30000:60000));this.publish();
     }).catch(()=>{row.ended=true;this.sessions.delete(id);if(owners.get(id)===this)owners.delete(id);this.failures.set(id,Date.now()+60000);this.publish();});
     const deadline=Date.now()+(this.options.handshakeTimeoutMs??45000);
     while(this.valid(g)&&!row.ended&&!peer.wsAlive&&Date.now()<deadline){await sleep(250);this.publish();}
     if(peer.wsAlive&&this.valid(g)){
      row.connectedAt=Date.now();this.publish();
      this.log('KeepAlive',`[Clink多桌面] ${id} 已连接，允许启动下一台`,'success');
      await sleep(this.options.betweenMs??5000);
     }else if(!row.ended){this.stopDesktop(id);this.failures.set(id,Date.now()+60000);}
    }catch(e){
     if(!row&&owners.get(id)===this)owners.delete(id);
     this.failures.set(id,Date.now()+60000);
     if(this.valid(g)){const reason=['AUTOBOOT_DISABLED','MANUAL_SHUTDOWN'].includes(e.code)?e.message:'原生连接未就绪，60秒后重试';this.client.account.stats.lastError=reason;this.log('KeepAlive',`[Clink多桌面] ${id} ${reason}`,'warning');}
    }finally{this.current=null;}
   }
  }catch(e){if(this.enabled)this.log('KeepAlive','[Clink多桌面] 同步失败，将延后重试','warning');}
  finally{this.busy=false;this.publish();}
 }
}
module.exports={NativeAccountManager};
