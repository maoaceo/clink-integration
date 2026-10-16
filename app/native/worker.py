#!/usr/bin/env python3
import sys,json,os,tempfile,subprocess,signal,selectors,time,re
from pathlib import Path

def main():
    payload=json.loads(sys.stdin.readline(1048576))
    d=payload['desktopInfo'];a=payload['identity'];requested=int(payload.get('seconds',60));seconds=0 if requested==0 else max(15,min(requested,7200))
    endpoint=d['clinkLvsOutHost'];host,port=endpoint.rsplit(':',1)
    if not host or not 1<=int(port)<=65535:raise ValueError('endpoint')
    client=Path(os.environ.get('CTYUN_NATIVE_DIR','/opt/ctyun-clink/runtime/opt/ctg/CtyunClouddeskPublic')).resolve()
    root=Path(os.environ.get('CTYUN_NATIVE_STATE','/var/lib/ctyun-clink/native'));root.mkdir(parents=True,exist_ok=True,mode=0o700)
    here=Path(__file__).resolve().parent
    with tempfile.TemporaryDirectory(prefix='clink-',dir=root) as tmp:
        home=Path(tmp)
        for n in ('config','cache','data','run'):(home/n).mkdir(mode=0o700)
        cfg={k:d[k] for k in ('caCert','clientCert','clientKey','token','osType','osName','clientStrategy','clipBoardJson','fileRedirectJson','filterString','usbReadonly','waterMark','clientControlStrategys') if k in d}
        cfg.update({'host':host,'tlsPort':port,'spiceAddress':str(d['internalIp'])+':'+str(d['internalPort']),'hostSubject':d['subject'],'serverTime':int(d['timestamp']//1000),'desktopId':str(d['desktopId']),'userId':str(a.get('userId','')),'userAccount':a.get('userAccount',''),'userName':a.get('userName',''),'deviceType':str(a['deviceType']),'deviceCode':a['deviceCode'],'qtMode':1,'allowedChannels':2,'useQuic':0,'localDebug':0,'disableLvs':False,'fileRedirect':False,'clipboard':0,'ptype':0,'productName':'CtyunClouddeskPublic','_etaSeconds':seconds})
        session=home/'session.json';session.write_text(json.dumps(cfg,ensure_ascii=False));session.chmod(0o600)
        import shutil
        shutil.copyfile(here/'HeadlessClink.qml',home/'HeadlessClink.qml')
        env=os.environ.copy();env.update({'HOME':str(home),'XDG_CONFIG_HOME':str(home/'config'),'XDG_CACHE_HOME':str(home/'cache'),'XDG_DATA_HOME':str(home/'data'),'XDG_RUNTIME_DIR':str(home/'run'),'QT_QPA_PLATFORM':'xcb','QT_QUICK_BACKEND':'software','QTWEBENGINE_DISABLE_SANDBOX':'1','QTWEBENGINE_CHROMIUM_FLAGS':'--disable-gpu','LD_LIBRARY_PATH':str(client/'lib'),'QT_PLUGIN_PATH':str(client/'plugins')})
        p=subprocess.Popen(['xvfb-run','-a','-s','-screen 0 1024x768x24 -nolisten tcp',str(client/'clouddesktop-qml'),'-subapp','-qmlpath',str(home/'HeadlessClink.qml')],cwd=client,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,start_new_session=True)
        prev={s:signal.signal(s,lambda *args: (_ for _ in ()).throw(KeyboardInterrupt())) for s in (signal.SIGTERM,signal.SIGINT)}
        sel=selectors.DefaultSelector();sel.register(p.stdout,selectors.EVENT_READ);buffer=b'';deadline=time.monotonic()+seconds+20 if seconds else float('inf');ever=False
        try:
            while time.monotonic()<deadline:
                for key,_ in sel.select(1):
                    data=os.read(key.fileobj.fileno(),65536)
                    if not data:sel.unregister(key.fileobj);continue
                    buffer+=data
                    while b'\n' in buffer:
                        line,buffer=buffer.split(b'\n',1)
                        if b'ETA_HEADLESS ' not in line:
                            text=line.decode(errors='replace')
                            if any(k in text.lower() for k in ['token','secret','password','clientkey','clientcert','cacert','certificate pem','-----begin']):continue
                            if any(k in text for k in ['QQmlApplicationEngine failed','is not a type','Cannot load library','Permission denied','No such file','qml_url is','QML start','instance','Unable to assign','QML onObjectCreated','XMLHttpRequest','ReferenceError','TypeError','SyntaxError','Error:','error','failed','SSL','ssl','request url','QML Item']):
                                print(json.dumps({'event':'diagnostic','message':text[-300:]}),flush=True)
                            continue
                        event=line.split(b'ETA_HEADLESS ',1)[1].decode(errors='replace').strip()
                        if re.fullmatch(r'(state=\d+|native-state=\d+ code=\d+|event-name=[a-zA-Z0-9_-]+)',event) or event in ('startup','run-submit','reply contextPresent=true','reply contextPresent=false','main-net-delay','stop=duration','stop=activity-timeout','config-or-run-failed','notify-parse-failed'):
                            if event in ('state=2','state=3'):ever=True
                            print(json.dumps({'event':event}),flush=True)
                    if len(buffer)>262144:buffer=buffer[-8192:]
                if p.poll() is not None:break
        except KeyboardInterrupt:pass
        finally:
            for s,h in prev.items():signal.signal(s,h)
            try:os.killpg(p.pid,signal.SIGTERM)
            except ProcessLookupError:pass
            try:p.wait(4)
            except subprocess.TimeoutExpired:os.killpg(p.pid,signal.SIGKILL);p.wait()
            sel.close();p.stdout.close()
        if not ever:
            count=0
            for log in home.rglob('*.log'):
                if log.stat().st_size>5*1024*1024:continue
                for line in log.read_text(errors='replace').splitlines():
                    low=line.lower()
                    if any(k in low for k in ['ssl','failed','error','denied']) and not any(k in low for k in ['token','secret','password','cert','key','account','user','config','arg','param']):
                        if count<15:print(json.dumps({'event':'diagnostic','message':line[-300:]}),flush=True);count+=1
        print(json.dumps({'event':'result','everConnected':ever,'nativeExit':p.returncode}),flush=True)
        return 0 if ever else 2
if __name__=='__main__':
    try:sys.exit(main())
    except Exception as e:
        import traceback
        tb=traceback.extract_tb(e.__traceback__)[-1]
        print(json.dumps({'event':'failed','type':type(e).__name__,'line':tb.lineno}),flush=True);sys.exit(1)
