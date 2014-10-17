function init() {
    // Instanciate sigma.js and customize rendering :
    var sigInst = new sigma({
        container: "sigma-expand",
        settings: {
            defaultNodeColor: '#ec5148',
            defaultEdgeType: 'curve'
        }
    });

    sigma.parsers.json("json", sigInst);
    console.log(sigInst);

    // Start the ForceAtlas2 algorithm
    // (requires "sigma.forceatlas2.js" to be included)
    sigInst.startForceAtlas2();

    var isRunning = true;
    document.getElementById('stop-layout').addEventListener('click',function(){
        if(isRunning){
            isRunning = false;
            sigInst.stopForceAtlas2();
            document.getElementById('stop-layout').childNodes[0].nodeValue = 'Start Layout';
        }else{
            isRunning = true;
            sigInst.startForceAtlas2();
            document.getElementById('stop-layout').childNodes[0].nodeValue = 'Stop Layout';
        }
    },true);
    document.getElementById('rescale-graph').addEventListener('click',function(){
        sigInst.position(0,0,1).draw();
    },true);

}

if (document.addEventListener) {
    document.addEventListener("DOMContentLoaded", init, false);
} else {
    window.onload = init;
}