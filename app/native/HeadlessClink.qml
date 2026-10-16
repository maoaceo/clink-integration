import QtQuick 2.15
import ArkClinkConnection 1.0
Item {
    property string contextId: ''
    property double lastActivity: Date.now()
    property bool connected: false
    property bool stopping: false
    ArkClinkConnection {
        id: core
        onClinkNotify: function(message) {
            try {
                var x=JSON.parse(message);
                if (x.type===201) {
                    if (x.data && x.data.context) contextId=x.data.context;
                    console.info('ETA_HEADLESS reply contextPresent='+(contextId!==''));
                } else if (x.name==='connect-state') {
                    console.info('ETA_HEADLESS native-state='+String(x.arg.state)+' code='+String(x.arg.statuscode||0));
                    var state=x.arg.state;
                    connected=(state===2 || state===3);
                    console.info('ETA_HEADLESS state='+state);
                    if (connected) lastActivity=Date.now();
                    if (state===5 && !stopping) { stopping=true; exitTimer.start(); }
                } else if (x.name==='main-net-delay') {
                    lastActivity=Date.now();
                    console.info('ETA_HEADLESS main-net-delay');
                }
                else { console.info('ETA_HEADLESS event-name='+String(x.name)); }
            } catch(e) { console.info('ETA_HEADLESS notify-parse-failed'); }
        }
    }
    function stopSession(reason) {
        if (stopping) return;
        stopping=true;
        console.info('ETA_HEADLESS stop='+reason);
        if (contextId) core.clinkCall(JSON.stringify({type:100,id:'stop-1',context:contextId,channelName:'clink',name:'stop',arg:{}}));
        exitTimer.start();
    }
    Timer { id: stopTimer; onTriggered: stopSession('duration') }
    Timer { id: exitTimer; interval: 1000; onTriggered: Qt.quit() }
    Timer {
        interval: 15000; running: true; repeat: true
        onTriggered: { if (Date.now()-lastActivity>90000) stopSession('activity-timeout'); }
    }
    Component.onCompleted: {
        console.info('ETA_HEADLESS startup');
        try {
            var xhr=new XMLHttpRequest();xhr.open('GET',Qt.resolvedUrl('session.json'),false);xhr.send();
            var cfg=JSON.parse(xhr.responseText);var seconds=cfg._etaSeconds;delete cfg._etaSeconds;
            console.info('ETA_HEADLESS run-submit');
            core.clinkCall(JSON.stringify({type:100,id:'headless-1',channelName:'clink',name:'run',arg:cfg}));
            if (seconds>0) { stopTimer.interval=seconds*1000;stopTimer.start(); }
        } catch(e) { console.info('ETA_HEADLESS config-or-run-failed');Qt.quit(); }
    }
}
