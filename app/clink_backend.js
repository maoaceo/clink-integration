'use strict';
const {spawn}=require('child_process');
const path=require('path');
const active=new Map();
function runNative(client,desktop,info,seconds,log){
 if(process.env.CTYUN_NATIVE_PERSISTENT==='1')seconds=0;
 const key=String(desktop.objId||desktop.desktopId);
 if(active.has(key))return Promise.resolve({success:false,reason:'native_desktop_already_active'});
 return new Promise(resolve=>{
  let child,ever=false,finished=false,buffer='',lastLog=0;
  const persistent=Number(seconds)===0;
  const timeoutMs=(Math.min(7200,Math.max(15,Number(seconds)||60))+30)*1000;
  const finish=(reason)=>{
   if(finished)return;finished=true;clearTimeout(timer);active.delete(key);
   if(client.endCurrentSession===stop)client.endCurrentSession=null;
   client.wsAlive=false;client.metrics.status='offline';
   if(client.account.stats)client.account.stats.keepAliveStatus='offline';
   resolve({success:ever,reason,backend:'official-clink'});
  };
  const stop=()=>{client.wsAlive=false;client.metrics.status='stopping';if(child&&!child.killed)child.kill('SIGTERM');};
  const timer=persistent?null:setTimeout(stop,timeoutMs);
  try{
   child=spawn('python3',[path.join(__dirname,'native','worker.py')],{stdio:['pipe','pipe','ignore'],env:process.env});
   active.set(key,child);client.endCurrentSession=stop;
   const identity={userId:client.loginInfo?.userId,userAccount:client.loginInfo?.userAccount,userName:client.loginInfo?.userName,deviceType:client.deviceType,deviceCode:client.account.deviceCode};
   child.stdin.on('error',()=>{});
   child.stdin.end(JSON.stringify({desktopInfo:info,identity,seconds})+'\n');
   child.stdout.on('data',chunk=>{
    buffer+=chunk.toString();if(buffer.length>262144)buffer=buffer.slice(-8192);
    let i;while((i=buffer.indexOf('\n'))!==-1){
     const line=buffer.slice(0,i);buffer=buffer.slice(i+1);let item;try{item=JSON.parse(line);}catch{continue;}
     if(item.event==='state=2'||item.event==='state=3'||/^native-state=[23] code=0$/.test(item.event)){
      const firstConnected=!ever;ever=true;client.wsAlive=true;client.metrics.status='online';
      if(client.account.stats){client.account.stats.keepAliveStatus='online';client.account.stats.lastError='';}client.account.nativeNeedsReauth=false;client.metrics.lastHeartbeatResult='官方 Clink 主通道已连接';
      if(firstConnected)log('KeepAlive',`[Clink] 桌面 ${key} 原生主通道已连接`,'success');
     }else if(item.event==='main-net-delay'){
      client.metrics.lastHeartbeatTime=new Date().toLocaleString('sv-SE',{timeZone:'Asia/Shanghai'});
      if(Date.now()-lastLog>30000){lastLog=Date.now();log('Heartbeat',`[Clink] 桌面 ${key} 收到主通道延迟通知`,'info');}
     }else if(item.event.startsWith('native-state=')){if(item.event.startsWith('native-state=4 ')||item.event.startsWith('native-state=5 ')){client.wsAlive=false;client.metrics.status='offline';}client.metrics.lastNativeState=item.event;log('KeepAlive','[Clink] '+item.event,'info');
     }else if(['startup','run-submit','config-or-run-failed','reply contextPresent=true'].includes(item.event)){log('KeepAlive','[Clink] '+item.event,'info');
     }else if(item.event==='diagnostic'){log('KeepAlive','[Clink] '+String(item.message),'info');
     }else if(item.event==='failed'){log('KeepAlive','[Clink] worker 失败类型：'+String(item.type||'unknown'),'error');
     }else if(item.event==='result'){log('KeepAlive','[Clink] worker 退出码：'+String(item.nativeExit),'info');
     }else if(item.event==='state=5'){client.wsAlive=false;client.metrics.status='offline';
   if(client.account.stats)client.account.stats.keepAliveStatus='offline';}
    }
   });
   child.on('error',()=>finish('native_worker_start_failed'));
   child.on('close',code=>finish(code===0?'native_duration_complete':'native_worker_disconnected'));
  }catch{stop();finish('native_worker_failed');}
 });
}
function stopAll(){for(const child of active.values())try{child.kill('SIGTERM');}catch{};}
process.on('SIGTERM',stopAll);process.on('SIGINT',stopAll);process.on('exit',stopAll);
module.exports={runNative,stopAll};
