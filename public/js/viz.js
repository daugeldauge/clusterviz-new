
var width = 960,
    height = 960;

var color = d3.scale.category20();

var radius = d3.scale.sqrt()
    .range([0, 6]);

var svg = d3.select("body").append("svg")
    .attr("width", width)
    .attr("height", height)
    .style("background", "lightgrey");

var force = d3.layout.force()
    .size([width, height])
    .charge(-400)
    .linkDistance(function(d) { return radius(d.source.size) + radius(d.target.size) + 20; });

d3.json("/neo", function(graph) {
    //console.log(graph);
    graph.index = [];
    for (var i = 0; i < graph.nodes.length; ++i) {
        graph.index[graph.nodes[i].id] = i;
    }
    //console.log(graph.index);
    // for (var i = 1; i < graph.links.length; ++i) {
    //     graph.links[i].source = graph.index[graph.links[i].source];
    //     graph.links[i].target = graph.index[graph.links[i].source];
    // }
    //console.log(graph.links);
    graph.links.forEach(function (link) {
        link.source = graph.index[link.source];
        link.target = graph.index[link.target];
        //console.log(link);
    });

    force
        .nodes(graph.nodes)
        .links(graph.links)
        .on("tick", tick)
        .start();

    var link = svg.selectAll(".link")
        .data(graph.links)
        .enter().append("g")
        .attr("class", "link");

    link.append("line")
        .style("stroke-width", "1.5px");

    var node = svg.selectAll(".node")
        .data(graph.nodes)
        .enter().append("g")
        .attr("class", "node")
        .on("click", click)
        .on("dblclick", dblclick)
        .call(force.drag);

    node.append("circle")
        .attr("r", function(d) { return radius(d.size); })
        .style("fill", function(d) { return color(d.type); });

    node.append("text")
        .attr("dy", ".35em")
        .attr("text-anchor", "middle")
        .text(function(d) { return d.type; });

    function tick() {
        link.selectAll("line")
            .attr("x1", function(d) { return d.source.x; })
            .attr("y1", function(d) { return d.source.y; })
            .attr("x2", function(d) { return d.target.x; })
            .attr("y2", function(d) { return d.target.y; });

        node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
    }

    function click(d) {
        $.getJSON("/nodes/" + d.id, function(node) {
            var table = $("#node-info")
                .empty()
                .css("text-align", "left")
                //.attr("border", 0.1)
                .append("<thead><tr><th>Key</th><th>Value</th></tr></thead>")
                .append("<tr><td>id</td><td>" + d.id +"</td></tr>");

            $.each(node, function(key, value) {
                table.append("<tr><td>" + key + "</td><td>" + value +"</td></tr>");
            });
            table.append("</table>");
        });
    }

    function dblclick(d) {
       alert("dblclick on " + d.id);
    }
});