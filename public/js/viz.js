//function init() {
    // Instanciate sigma.js and customize rendering :
    var sigInst = new sigma({
        container: "sigma-expand",
        settings: {
            defaultNodeColor: '#ec5148',
            drawEdges: false
        }
    });

    sigma.parsers.json("arctic.json", sigInst);
    console.log(sigInst);
//
//    // Start the ForceAtlas2 algorithm
//    // (requires "sigma.forceatlas2.js" to be included)
//    sigInst.startForceAtlas2({worker: true});
//
//    var isRunning = true;
//    document.getElementById('stop-layout').addEventListener('click',function(){
//        if(isRunning){
//            isRunning = false;
//            sigInst.stopForceAtlas2();
//            document.getElementById('stop-layout').childNodes[0].nodeValue = 'Start Layout';
//        }else{
//            isRunning = true;
//            sigInst.startForceAtlas2();
//            document.getElementById('stop-layout').childNodes[0].nodeValue = 'Stop Layout';
//        }
//    },true);
//    document.getElementById('rescale-graph').addEventListener('click',function(){
//        sigInst.graph.nodes().forEach(function(node){
//            console.log(node);
//            node.x = Math.random() * 10;
//            node.y = Math.random() * 10;
//        });
//        sigInst.refresh();
//    },true);
//
//}
//
//if (document.addEventListener) {
//    document.addEventListener("DOMContentLoaded", init, false);
//} else {
//    window.onload = init;
//}



// Start the ForceAtlas2 algorithm:
sigInst.startForceAtlas2({worker: true});