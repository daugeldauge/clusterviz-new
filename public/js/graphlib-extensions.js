(function () {
    var Graph = dagre.graphlib.Graph.prototype;

    Graph.eachNode = function(func) {
        for (var id in this._nodes) {
            func(this._nodes[id], id);
        }
    };

    Graph.filterNodes = function(filter) {
        var copy = new this.constructor();
        copy.graph(this.graph());
        this.eachNode(function(value, u) {
            if (filter(value)) {
                copy.setNode(u, value);
            }
        });
        this.eachEdge(function(id, v, w, value) {
            if (copy.hasNode(v) && copy.hasNode(w)) {
                copy.setEdge(v, w, value);
            }
        });
        return copy;
    };

    Graph.copy = function() {
        return this.filterNodes(function() { return true; });
    };

    Graph.eachEdge = function(func) {
        var id, edge;
        for (id in this._edgeObjs) {
            edge = this._edgeObjs[id];
            func(id, edge.v, edge.w, this._edgeLabels[id]);
        }
    };

    Graph.getNodes = function() {
        var graph = this;
        return this.nodes().map(function (id) { return graph.node(id); });
    }

    Graph.getLinks = function() {
        var graph = this;
        return graph.edges().map(function (edge) {
            return { 
                source: graph.node(edge.v),
                target: graph.node(edge.w)
            };
        });
    }
})();