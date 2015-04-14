function collapse(graph, id) {
    var successors = graph.successors(id);
    successors.forEach(function(successor) {
        collapse(successor);
        graph.removeNode(successor);
    }); 
}

function topologicalSort(graph) {
    var currentLevel = 0;
    var currentGraph = graph; 
    
    do {
        currentGraph = currentGraph.copy();

        currentGraph.sources().forEach(function(id) {
            currentGraph.node(id).level = currentLevel;
            currentGraph.removeNode(id);
        });

        ++currentLevel;
    } while(currentGraph.nodeCount() != 0)
    return currentLevel - 1;
}

function areSimilar(graph, idA, idB) {
    var nodeA = graph.node(idA);
    var nodeB = graph.node(idB);
    
    if (!nodeA || !nodeB) {
        debugger;
    }

    if (idA == idB || nodeA.type !== nodeB.type) {
        return false;
    }


    var succsA = graph.successors(idA);    
    var succsB = graph.successors(idB);

    if (succsA.length != succsB.length) {
        return false;
    }

    succsB = d3.set(succsB);
    
    for (var i = 0; i < succsA.length; ++i) {
        var isFound = false;
        
        for (var j in succsB._) {
            if (areSimilar(graph, succsA[i], j)) {
                succsB.remove(j);
                isFound = true;
                break;
            }
        }

        if (!isFound) {
            return false;
        }
    }
    
    return true;
}

function aggregate(graph) {
    var graph = graph.copy();
    
    var maxLevel = topologicalSort(graph);

    for(var level = maxLevel - 1; level >= 0; --level) {

        var nodes = graph.nodes().filter(function(id) {
            return graph.node(id).level == level;
        });

        nodes.forEach(function(parentId) {
            
            var fringe = d3.set(graph.successors(parentId));

            while(!fringe.empty()) {
                var rootId = fringe.values()[0];
                fringe.remove(rootId)
                
                var root = graph.node(rootId);
                
                root.aggregated = [rootId];
                root.number = 1;
                
                fringe.forEach(function(id) {
                    if (areSimilar(graph, rootId, id)) {
                        
                        merge(graph, rootId, id);
                        fringe.remove(id);
                        
                    }
                });
            }
        });
    }
    return graph;
}

/* A and B must be similar */
function merge(graph, idA, idB) {
    var nodeA = graph.node(idA);
    var nodeB = graph.node(idB);
    
    var successorsB = d3.set(graph.successors(idB));
    
    graph.successors(idA).forEach(function(succA) {    
        for (var succB in successorsB._) {
            if (areSimilar(graph, succA, succB)) {
                successorsB.remove(succB);
                merge(graph, succA, succB);
                break;
            }
        }
    });

    if (nodeB.aggregated) {
        nodeA.aggregated = nodeA.aggregated.concat(nodeB.aggregated);
    } else {
        nodeA.aggregated.push(idB);
        nodeA.number++;
    }

    graph.removeNode(idB);
}