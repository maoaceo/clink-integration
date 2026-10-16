'use strict';
class PowerGuardError extends Error{constructor(message,code){super(message);this.code=code;}}
async function ensurePower({client,desktop,state,operate,isActive=()=>true,log=()=>{},now=Date.now,cooldownMs=180000}){
 const id=String(desktop.desktopId||desktop.objId);const account=client.account;
 const prefs=(account.desktops||[]).find(d=>String(d.desktopId||d.objId)===id)||desktop;
 const current=()=>isActive()&&client.workerRunning!==false&&account.enabled!==false&&account.features?.keepAlive!==false&&prefs.keepaliveEnabled!==false;
 if(!current())throw new PowerGuardError('连接已取消','CANCELLED');
 if(account.manualShutdown===true)throw new PowerGuardError('用户手动关机，自动启动已阻止','MANUAL_SHUTDOWN');
 if(!state||state.runningTask||state.runningTaskName||state.desktopState==='TASKRUNING')return {waiting:true};
 const kind=String(state.desktopState||'').toUpperCase();
 if(kind==='ACTIVE')return {ready:true};
 const action=kind==='SHUTOFF'?'poweron':(['SUSPENDED','PAUSED','HIBERNATED'].includes(kind)?'awake':null);
 if(!action)return {waiting:true};
 if(account.features?.autoBoot===false||prefs.autoBootEnabled===false)throw new PowerGuardError('自动开机已关闭，等待用户启动桌面','AUTOBOOT_DISABLED');
 const owner=client._nativePowerOwner||client;
 if(!owner._nativePowerAttempts)owner._nativePowerAttempts=new Map();
 const attempts=owner._nativePowerAttempts;
 if(attempts.has(id)&&now()-attempts.get(id)<cooldownMs)return {waiting:true,cooldown:true};
 if(!current())throw new PowerGuardError('连接已取消','CANCELLED');
 attempts.set(id,now()); // Record before network call: unknown outcome must not immediately replay.
 const response=await operate(action);
 log('KeepAlive',`[Clink自动开机] ${id} ${action==='poweron'?'开机':'唤醒'}请求已受理，等待实时状态确认`,'info');
 return {requested:true,action};
}
module.exports={ensurePower,PowerGuardError};
