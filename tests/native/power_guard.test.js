'use strict';
const assert=require('assert');const {ensurePower}=require('../../app/native_power_guard');
(async()=>{
 const desktop={desktopId:'test-1',autoBootEnabled:true,keepaliveEnabled:true};const client={workerRunning:true,account:{enabled:true,features:{keepAlive:true,autoBoot:true},desktops:[desktop]}};
 let calls=[];let clock=1000;const args={client,desktop,isActive:()=>true,now:()=>clock,operate:async action=>{calls.push(action);return {};}};
 await ensurePower({...args,state:{desktopState:'ACTIVE'}});assert.equal(calls.length,0);
 await ensurePower({...args,state:{desktopState:'TASKRUNING',runningTask:1301}});assert.equal(calls.length,0);
 await ensurePower({...args,state:{desktopState:'UNKNOWN'}});assert.equal(calls.length,0);
 await ensurePower({...args,state:{desktopState:'SHUTOFF'}});assert.deepEqual(calls,['poweron']);
 await ensurePower({...args,state:{desktopState:'SHUTOFF'}});assert.equal(calls.length,1);
 clock+=180001;await ensurePower({...args,state:{desktopState:'SUSPENDED'}});assert.deepEqual(calls,['poweron','awake']);
 desktop.autoBootEnabled=false;await assert.rejects(ensurePower({...args,state:{desktopState:'SHUTOFF'}}),e=>e.code==='AUTOBOOT_DISABLED');assert.equal(calls.length,2);
 desktop.autoBootEnabled=true;client.account.features.autoBoot=false;await assert.rejects(ensurePower({...args,state:{desktopState:'SHUTOFF'}}),e=>e.code==='AUTOBOOT_DISABLED');
 client.account.features.autoBoot=true;client.account.manualShutdown=true;await assert.rejects(ensurePower({...args,state:{desktopState:'ACTIVE'}}),e=>e.code==='MANUAL_SHUTDOWN');
 client.account.manualShutdown=false;await assert.rejects(ensurePower({...args,isActive:()=>false,state:{desktopState:'SHUTOFF'}}),e=>e.code==='CANCELLED');
 clock+=180001;let failed=0;await assert.rejects(ensurePower({...args,state:{desktopState:'SHUTOFF'},operate:async()=>{failed++;throw Error('network unknown');}}));
 await ensurePower({...args,state:{desktopState:'SHUTOFF'},operate:async()=>{failed++;}});assert.equal(failed,1);
 console.log('PASS: active/task/unknown no power; SHUTOFF start; suspended wake; cooldown; flags; manual shutdown; cancellation; unknown network no immediate replay');
})().catch(e=>{console.error(e);process.exit(1)});
