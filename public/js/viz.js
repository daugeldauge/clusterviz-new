$("form").submit(function draw() {
    $("svg").remove();

    var cluster = $("#cluster").val();
    var edgeType = $("#edge-type").val();
    var levels = $("#levels").val();

    var w = $("#canvas").innerWidth(),
        h = $("#canvas").innerHeight();

    var svg = d3.select("#canvas").append("svg:svg")
        .attr("width", w)
        .attr("height", h);

    svg.append("svg:rect")
        .attr("width", w)
        .attr("height", h)
        .style("fill", "none")
        .style("stroke", "#000");

    var svgLines = svg.append("g");
    var svgNodes = svg.append("g");

    var color = d3.scale.category20();

    var radius = parseInt($("#radius").val());

    var force = d3.layout.force()
        .gravity($("#gravity").val())
        .distance(40)
        .charge($("#charge").val())
        .size([w, h]);

    var nodes,
        links, 
        index,
        indexSize;

    $("#gravity") .change(function() { force.gravity(this.value);     update(); });
    $("#charge")  .change(function() { force.charge(this.value);      update(); });
    $("#radius")  .change(function() { radius = parseInt(this.value); update(); });


    d3.json("/neo?levels=" + levels + "&type=" + edgeType + "&cluster=" + cluster , function(json) {
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

        var link = svgLines.selectAll("line.link")
            .data(links, function(d) { return d.source.id + "-" + d.target.id; });

        link.enter().insert("line")
            .attr("class", "link");

        link.exit().remove();

        var node = svgNodes.selectAll("g.node")
            .data(nodes, function(d) { return d.id;});

        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .on("click", showInfo)
            .on("dblclick", expand)
            .call(force.drag);

        nodeEnter.append("circle")
            .style("fill", function(d) { return color(d.type); });

        var circle = svg.selectAll("circle");   

        nodeEnter.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function(d) { return d.type; });
        
        node.exit().remove();

        // force.on("tick", function() {
        //   link.attr("x1", function(d) { return d.source.x; })
        //       .attr("y1", function(d) { return d.source.y; })
        //       .attr("x2", function(d) { return d.target.x; })
        //       .attr("y2", function(d) { return d.target.y; });

        //   node.attr("transform", function(d) { return "translate(" + d.x + "," + d.y + ")"; });
        // });

        force.on("tick", function () {
            circle.attr("r", radius);

            node.attr("transform", function(d) { 
                return "translate(" + 
                    (d.x = Math.max(radius + 1, Math.min(w - radius - 1, d.x))) + "," +
                    (d.y = Math.max(radius + 1, Math.min(h - radius - 1, d.y))) + ")";
            });

            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
        });       
        force.start();
    }

    function showInfo(d) {
        d3.json("/node-info/" + d.id + "?cluster=" + cluster, function(nodeInfo) {
            var table = $("#node-info")
                .empty()
                .css("text-align", "left")
                //.attr("border", 0.1)
                .append("<thead><tr><th>Key</th><th>Value</th></tr></thead>")
                .append("<tr><td>id</td><td>" + d.id +"</td></tr>");

            for (key in nodeInfo) {
                table.append("<tr><td>" + key + "</td><td>" + toCell(nodeInfo[key]) +"</td></tr>");
            }
            table.append("</table>");
        });
    }

    function toCell(x) {
        if ($.isPlainObject(x)) {
            cell = ""
            for (key in x) {
                cell += "<b>" + key + ":</b>&nbsp;" + toCell(x[key]) + "<br>";
            }
            return cell;
        } else {
            return x;
        }
    }

    function expand(d) {
        //alert("dblclick on " + d.id);
        d3.json("/node-out-relations/" + d.id + "?type=" + edgeType + "&cluster=" + cluster, function(graph) {
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
});