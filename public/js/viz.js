var width = $("#canvas").width(),
    height = $("#canvas").height();

var color = d3.scale.category20();

var radius = d3.scale.sqrt()
    .range([0, 6]);

var svg = d3.select("#canvas").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "lightgrey");

var force = d3.layout.force()
    // .nodes(nodes)
    // .links(links)
    .gravity(.05)
    .size([width, height])
    .charge(-400)
    .linkDistance(function(d) { return radius(d.source.size) + radius(d.target.size) + 20; })
    .on("tick", tick);

var graph;

var node = svg.selectAll(".node"),
    link = svg.selectAll(".link");

d3.json("/neo", function(json) {
    //console.log(graph);
    graph = json;
    graph.index = [];
    graph.indexSize = graph.nodes.length;
    for (var i = 0; i < graph.nodes.length; ++i) {
        graph.index[graph.nodes[i].id] = i;
    }
    graph.links.forEach(function (link) {
        link.source = graph.nodes[graph.index[link.source]];
        link.target = graph.nodes[graph.index[link.target]];
        //console.log(link);
    });

    force.nodes(graph.nodes)
        .links(graph.links);

    update();
});


function update() {
    link = link.data(force.links());
    link.enter().append("g").attr("class", "link");
    link.append("line");
    link.exit().remove();

    node = node.data(force.nodes());
    node.enter().append("g")
        .attr("class", "node")
        .on("click", showInfo)
        .on("dblclick", expand)
        .call(force.drag);

    node.append("circle")
        .attr("r", function(d) { return radius(d.size); })
        .style("fill", function(d) { return color(d.type); });

    node.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.type; });
    node.exit().remove();


    force.start();
};


function tick() {
    link.selectAll("line")
        .attr("x1", function(d) { return d.source.x; })
        .attr("y1", function(d) { return d.source.y; })
        .attr("x2", function(d) { return d.target.x; })
        .attr("y2", function(d) { return d.target.y; });

    node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
}

function showInfo(d) {
    d3.json("/node-info/" + d.id, function(nodeInfo) {
        var table = $("#node-info")
            .empty()
            .css("text-align", "left")
            //.attr("border", 0.1)
            .append("<thead><tr><th>Key</th><th>Value</th></tr></thead>")
            .append("<tr><td>id</td><td>" + d.id +"</td></tr>");

        for (key in nodeInfo) {
            table.append("<tr><td>" + key + "</td><td>" + nodeInfo[key] +"</td></tr>");
        }
        table.append("</table>");
    });
}

function expand(d) {
    //alert("dblclick on " + d.id);
    d3.json("/node-out-relations/" + d.id, function(subgraph) {
        force.stop();

        console.log(subgraph.links.length);

        var oldIndexSize = graph.indexSize;
        subgraph.nodes.forEach(function(node) {
            if (!graph.index[node.id]) {
                graph.index[node.id] = graph.indexSize;
                graph.indexSize++;
            }
        });
        
        subgraph.links.forEach(function (link) {
            link.source = force.nodes()[graph.index[link.source]];
            var targetIndex = graph.index[link.target];
            if (targetIndex >= oldIndexSize) {
                force.nodes().push(subgraph.nodes[targetIndex - oldIndexSize]);
            }
            link.target = force.nodes()[targetIndex];
            force.links().push(link);
            update();
        });
        
    });    
}