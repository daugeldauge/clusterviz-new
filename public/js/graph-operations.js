function collapse(graph, id) {
    var successors = graph.successors(id);
    successors.forEach(function(successor) {
        collapse(graph, successor);
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

function areSimilar(graph, n1, n2) {

    if (n1 == n2 || !areTypesEqual(graph, n1, n2)) {
        return false;
    }

    var preds1 = graph.predecessors(n1);
    var preds2 = graph.predecessors(n2);

    if (!areArraysEqual(graph, preds1, preds2, areTypesEqual)) {
        return false;
    }

    var succs1 = graph.successors(n1);    
    var succs2 = graph.successors(n2);

    if (!areArraysEqual(graph, succs1, succs2, areSimilar)) {
        return false;
    }

    return true;
}

function areTypesEqual(graph, n1, n2) {
    return graph.node(n1).type === graph.node(n2).type;
}

function areArraysEqual(graph, arr1, arr2, areEqual) {
    
    if (arr1.length != arr2.length) {
        return false;
    }

    arr2 = d3.set(arr2);
    
    for (var i = 0; i < arr1.length; ++i) {
        var isFound = false;
        
        for (var j in arr2._) {
            if (areEqual(graph, arr1[i], j)) {
                arr2.remove(j);
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
                
                if (!root.aggregated) {
                    var value = {};
                    value.aggregated = [rootId];
                    value.number = 1;
                    value.id = root.id;
                    value.size = root.size;
                    value.type = root.type;
                    value.level = root.level;
                    graph.setNode(rootId, value);
                }
                
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