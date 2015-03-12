$("#draw-form").submit(function draw() {
    $("svg").remove();
    $(".last-updated").hide();
    $("#update-button").hide();
    $("#node-info").html("");

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
    var size = d3.scale.log();

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
            .on("dblclick", dblclick)
            .call(force.drag);

        nodeEnter.append("circle")
            .style("fill", function(d) { return color(d.type); })
            .style("stroke", function(d) { return d.size? "green": "red" })

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
            circle.attr("r", function(d) {
                return 3 * Math.log(d.size + 1) + radius;
            });

            node.attr("transform", function(d) { 
                return "translate(" + 
                    (d.x = Math.max(0, Math.min(w, d.x))) + "," +
                    (d.y = Math.max(0, Math.min(h, d.y))) + ")";
            });

            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
        });

        //topologicalSort();
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
        $(".last-updated#" + cluster).show();
        $("#update-button").show();
    }

    function toCell(x) {
        if ($.isPlainObject(x)) {
            var cell = ""
            for (key in x) {
                cell += "<b>" + key + ":</b>&nbsp;" + toCell(x[key]) + "<br>";
            }
            return cell;
        } else {
            return x;
        }
    }

    function getNumberOfChildren(d) {
        var n = 0;
        links.forEach(function (link) {
            if (link.source === d) {
                ++n;
            }
        });
        return n;
    }

    function dblclick(d) {
        if (d.size == getNumberOfChildren(d)) {
            var linksToRemove = collapse(d);
            linksToRemove.sort(function(a, b) {
                return a - b;
            });

            for (var i = linksToRemove.length - 1; i >=0; --i) {
                links.splice(linksToRemove[i], 1);
            }

            update();
        } else {
            expand(d);
        }
    }

    function expand(d) {
        //alert("dblclick on " + d.id);
        d3.json("/node-out-relations/" + d.id + "?type=" + edgeType + "&cluster=" + cluster, function(graph) {

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

    function collapse(d) {
        if (d.size == 0) {
            return [];
        }
        var linksToRemove = [];
        links.forEach(function (link, index) {
            if (link.source === d) {
                linksToRemove = linksToRemove.concat(collapse(link.target));
                linksToRemove.push(index);
                remove(link.target);
            }
        });
        return linksToRemove;
    }

    function remove(d) {
        nodes.splice(nodes.indexOf(d), 1);
        delete index[d.id];
        --indexSize;
    }

    function topologicalSort() {
        var currentLevel = 0;

        nodes.forEach(function(node) { node.level = undefined });

        do {
            // create array of zeros
            var nodeDegrees = Array.apply(null, new Array(indexSize)).map(Number.prototype.valueOf, 0); 
            
            links.forEach(function(link) { 
                if (link.source.level == undefined && link.target.level == undefined) {
                    nodeDegrees[index[link.target.id]] += 1;
                }
            });

            var numberOfNullDegreeNodes = 0;
            nodeDegrees.forEach(function(degree, index) {
                if (nodes[index].level == undefined && degree == 0) {
                    ++numberOfNullDegreeNodes;
                    nodes[index].level = currentLevel;
                }
            });

            ++currentLevel;
        } while(numberOfNullDegreeNodes != 0)
    }


    $("#update-button").click(function () {
        $.ajax({
            type: "GET",
            url: "/update",
            data: "cluster=" + cluster
        });
    });
});

$("#add-button").click(function () {
    $("#error-msg").toggle();
    $.ajax({
        type: "GET",
        url: "/add-cluster",
        data: $("#add-form").serialize(),
        success: function(){
            $("#add-modal").modal("hide");
            location.reload();  
        },
        error: function(){
            $("#error-msg").show();
            $("add-button").prop("disabled", true);
        }
    });
    $("add-button").prop("disabled", true);
});
