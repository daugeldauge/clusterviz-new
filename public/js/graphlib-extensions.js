var graphlib = dagre.graphlib;

graphlib.Graph.prototype.eachNode = function(func) {
  for (var id in this._nodes) {
    func(this._nodes[id], id);
  }
};

graphlib.Graph.prototype.filterNodes = function(filter) {
  var copy = new this.constructor();
  copy.graph(this.graph());
  this.eachNode(function(value, u) {
    if (filter(u)) {
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

graphlib.Graph.prototype.copy = function() {
  return this.filterNodes(function() { return true; });
};

graphlib.Graph.prototype.eachEdge = function(func) {
  var id, edge;
  for (id in this._edgeObjs) {
    edge=this._edgeObjs[id];
    func(id, edge.v, edge.w, this._edgeLabels[id]);
  }
};