var w = $("#canvas").innerWidth(),
    h = $("#canvas").innerHeight();

var svg = d3.select("#canvas").append("svg:svg")
    .attr("width", w)
    .attr("height", h);

var color = d3.scale.category20();

var radius = d3.scale.sqrt()
    .range([0, 6]);

var force = d3.layout.force()
    .gravity(.05)
    .distance(60)
    .charge(-400)
    .size([w, h]);

var nodes,
    links, 
    index,
    indexSize;


d3.json("/root", function(json) {
    index = [];
    nodes = json.nodes;
    links = json.links;

    indexSize = nodes.length;
    for (var i = 0; i < nodes.length; ++i) {
        index[nodes[i].id] = i;
    }
    links.forEach(function (link) {
        link.source = nodes[index[link.source]];
        link.target = nodes[index[link.target]];
        //console.log(link);
    });
    force.nodes(nodes)
        .links(links);
    update();
});

function update() {

    var link = svg.selectAll("line.link")
        .data(links, function(d) { return d.source.id + "-" + d.target.id; });

    link.enter().insert("line")
        .attr("class", "link");

    link.exit().remove();

    var node = svg.selectAll("g.node")
        .data(nodes, function(d) { return d.id;});

    var nodeEnter = node.enter().append("g")
        .attr("class", "node")
        .on("click", showInfo)
        .on("dblclick", expand)
        .call(force.drag);

    nodeEnter.append("circle")
        .attr("r", function(d) { return radius(d.size); })
        .style("fill", function(d) { return color(d.type); });

    nodeEnter.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.id; });
    
    node.exit().remove();

    force.on("tick", function() {
      link.attr("x1", function(d) { return d.source.x; })
          .attr("y1", function(d) { return d.source.y; })
          .attr("x2", function(d) { return d.target.x; })
          .attr("y2", function(d) { return d.target.y; });

      node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
    });

    force.start();
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
    d3.json("/node-out-relations/" + d.id, function(graph) {
        //force.stop();

        console.log(graph.links.length);

        var oldIndexSize = indexSize;
        graph.nodes.forEach(function(node) {
            if (index[node.id] == null) {
                nodes.push(node);
                index[node.id] = indexSize;
                indexSize++;
            }
        });

        graph.links.forEach(function (link) {
            link.source = nodes[index[link.source]];
            link.target = nodes[index[link.target]];
            links.push(link);
        });
        update();        
    });    
}