"use strict";

$("#draw-form").submit(function draw() {
    $("svg").remove();
    $(".last-updated").hide();
    $("#update-button").hide();
    $("#layout-opts").hide();
    $("#node-info").html("");
    $("#show-filter-modal-button").show();

    var cluster = $("#cluster").val();
    var edgeType = $("#edge-type").val();
    var levels = $("#levels").val();
    var layout = $("#layout").val();
    var aggregation = $("#aggregation")
        .change(function() { aggregation = $(this).prop("checked"); update(); })
        .prop("checked");

    var w = $("#canvas").innerWidth(),
        h = $("#canvas").innerHeight();

    var zoom = d3.behavior.zoom()
        .scaleExtent([0.1, 10])
        .on("zoom", function() {
            svg.attr("transform", "translate(" + d3.event.translate + ")scale(" + d3.event.scale + ")");
        });
    
    var svg = d3.select("#canvas").append("svg:svg")
        .attr("width", w)
        .attr("height", h)

    svg.append("svg:rect")
        .attr("width", w)
        .attr("height", h)
        .style("fill", "none")
        .style("stroke", "#000")
        .style("pointer-events", "all");

    svg = svg.call(zoom)
        .on("dblclick.zoom", null)
        .append("g");

    var svgPaths = svg.append("g");
    var svgLines = svg.append("g");
    var svgLabels = svg.append("g");
    var svgNodes = svg.append("g");

    var color = d3.scale.category20();
    var size = d3.scale.log();

    var radius = parseInt($("#radius").val());
    
    var graph = new dagre.graphlib.Graph()
        .setGraph({})
        .setDefaultEdgeLabel(function() { return {}; });

    var visibleGraph = graph;
    var filterFunction = undefined;

    switch(layout) {
        case "force-tree":
        case "force":
            var force = d3.layout.force()
                .gravity($("#gravity").val())
                .distance(40)
                .charge($("#charge").val())
                .size([w, h]);
            
            var isForceRunnnig = true;
            $("#pause-force-layout").click(function(e) {
                if (isForceRunnnig) {
                    force.stop();
                } else {
                    force.resume();
                }
                isForceRunnnig = !isForceRunnnig;
            });

            var drag = force.drag()
                .on("dragstart", function(d) { 
                    isForceRunnnig = true;
                    d3.event.sourceEvent.stopPropagation();
                })
                .on("dragend", function(d) { 
                    if (d3.event.sourceEvent.shiftKey) {
                        d.fixed = !d.fixed;
                    }
                    force.start();
                });
                

            $("#layout-opts").show();

            $("#gravity") .change(function() { force.gravity(this.value);     update(); });
            $("#charge")  .change(function() { force.charge(this.value);      update(); });
            $("#radius")  .change(function() { radius = parseInt(this.value); update(); });
            break;
        case "dagre":
            break;
    }

    d3.json("/neo?levels=" + levels + "&type=" + edgeType + "&cluster=" + cluster, load);

    function update() {
        var visibleGraph = filterFunction? smartFilter(graph, filterFunction): graph;

        if (aggregation) {
            visibleGraph = aggregate(visibleGraph);
        }
        
        var nodes = visibleGraph.getNodes(),
            links = visibleGraph.getLinks(),
            labeledLinks = links.filter(function(d) { return d.target.number && d.target.number > 1; });

        var link = svgLines.selectAll("line.link")
            .data(links, function(d) { return d.source.id + "-" + d.target.id; });

        link.enter().insert("line")
            .attr("class", "link");

        link.exit().remove();

        var label = svgLabels.selectAll("text.label")
            .data(labeledLinks, function(d) { return d.source.id + "-" + d.target.id + "-n" + d.target.number;  });

        label.enter().insert("text")
            .attr("class", "label")
            .text(function(d) { return d.target.number; });

        label.exit().remove();

        var node = svgNodes.selectAll("g.node")
            .data(nodes, function(d) { return d.id;});

        var nodeEnter = node.enter().append("g")
            .attr("class", "node")
            .on("click", handleClick)
            .on("dblclick", dblclick);

        nodeEnter.append("circle")
            .style("fill", function(d) { return color(d.type); })
            .style("stroke", function(d) { return d.size? "green": "red" });
            
        var circle = svg.selectAll("circle")
            .attr("r", function(d) {
            return 3 * Math.log(d.size + 1) + radius;
        });   

        nodeEnter.append("text")
            .attr("dy", ".35em")
            .attr("text-anchor", "middle")
            .text(function(d) { return d.type; });
        
        node.exit().remove();

        var tick = function tick(e) {

            if (layout === "force-tree") {
                var k = 10 * e.alpha;
                
                // groups.forEach(function(group) {
                //     var nodes = group.values;
                //     for (var i = 1; i < nodes.length; ++i) {
                //         var dx = nodes[i].x - nodes[0].x;
                //         var dy = nodes[i].y - nodes[0].y;
                //         nodes[i].x -= k * dx / Math.abs(dx);
                //         nodes[i].y -= k * dy / Math.abs(dy);
                //     }
                // });

                links.forEach(function(link) {
                    link.source.y -= k;
                    link.target.y += k;
                });


                var group = svgPaths.selectAll("path")
                    .data(groups)
                    .attr("d", groupPath);
                
                group.enter()
                    .insert("path", "circle")
                    .style("fill", groupFill)
                    .style("stroke", groupFill)
                    .style("stroke-width", radius * 6)
                    .style("stroke-linejoin", "round")
                    .style("opacity", .2)
                    .attr("d", groupPath);

                group.exit().remove();
            }            
            
            node.attr("transform", function(d) { 
                return "translate(" + 
                    d.x + "," +
                    d.y + ")";
            });

            label.attr("transform", function(d) { 
                return "translate(" + 
                    (d.source.x + d.target.x) / 2 + "," +
                    (d.source.y + d.target.y) / 2 + ")";
            });

            link.attr("x1", function(d) { return d.source.x; })
                .attr("y1", function(d) { return d.source.y; })
                .attr("x2", function(d) { return d.target.x; })
                .attr("y2", function(d) { return d.target.y; });
        };

        switch(layout) {
            case "force-tree":
                topologicalSort(graph);
                
                var groups = d3.nest()
                    .key(function(d) { return d.level; })
                    .entries(nodes)
                    .filter(function(group) {
                        return group.values.length > 2;
                    });
        
                var groupPath = function(d) {
                    return "M" + 
                        d3.geom.hull(d.values.map(function(i) { return [i.x, i.y]; }))
                    .join("L")
                    + "Z";
                };
        
                var groupFill = function(d, i) { return color(i); };
                /* NO BREAK ON PURPOSE*/
            case "force":
                nodeEnter.call(drag);
                isForceRunnnig = true;
                
                force.on("tick", tick)
                    .nodes(nodes)
                    .links(links)
                    .start();
                
                break;
            case "dagre":
                dagre.layout(graph);

                nodes.forEach(function(node){
                    node.x += w / 2  - graph.graph().width / 2;
                    node.y += h / 2 ;
                });

                tick();
                break;
        }
    }

    function load(json) {
        json.nodes.forEach(function(node) {
            graph.setNode(node.id, node);
        });                    

        json.links.forEach(function(link) {
            graph.setEdge(link.source, link.target);
        });
        
        update();
        $("#loading-modal").modal("hide");
    }

    function handleClick(node) {
        $("#node-info").empty();
        if (node.aggregated) {
            node.aggregated.forEach(function(id){
                showInfo(id);
            });
        } else {
            showInfo(node.id);
        }
    }

    function showInfo(id) {
        d3.json("/node-info/" + id + "?cluster=" + cluster, function(nodeInfo) {
            var table = $("<table>")
                .addClass("table table-bordered")
                .appendTo("#node-info");
            
            table.append("<thead><tr><th>Key</th><th>Value</th></tr></thead>")
                .append("<tr><td>id</td><td>" + id +"</td></tr>");

            for (var key in nodeInfo) {
                table.append("<tr><td>" + key + "</td><td>" + toCell(nodeInfo[key]) +"</td></tr>");
            }
        });
        $(".last-updated#" + cluster).show();
        $("#update-button").show();
    }

    function toCell(x) {
        if ($.isPlainObject(x)) {
            var cell = ""
            for (var key in x) {
                cell += "<b>" + key + ":</b>&nbsp;" + toCell(x[key]) + "<br>";
            }
            return cell;
        } else {
            return x;
        }
    }

    function dblclick(node) {
        if (node.aggregated) {            
            if (node.size == graph.successors(node.id).length) {
                node.aggregated.forEach(function(id){ collapse(graph, id); });
                update();
            } else {
                node.aggregated.forEach(expand);
            }
        } else {
            if (node.size == graph.successors(node.id).length) {
                collapse(graph, node.id);
                update();
            } else {
                expand(node.id);
            }
        }
    }

    function expand(id) {
        d3.json("/node-out-relations/" + id + "?type=" + edgeType + "&cluster=" + cluster, load);
    }

    $("#update-button").click(function () {
        $.ajax({
            type: "GET",
            url: "/update",
            data: "cluster=" + cluster
        });
    });

    var types, filteredTypes = d3.set();
    var linksThroughSuccessor = undefined;

    function smartFilter(graph, func) {
        var result = graph.filterNodes(func);
        
        if (!linksThroughSuccessor) {
            $.ajax({
                url: "/links-through-successor",
                data: {type: edgeType, cluster: cluster},
                async: false,
                dataType: "json",
                success: function(data) { linksThroughSuccessor = data }
            });
        }

        linksThroughSuccessor.forEach(function(link) {
            var v = link.source;
            var w = link.target
            if (result.hasNode(v) && result.hasNode(w) && !result.hasEdge(v, w)) {
                result.setEdge(v, w);
            }
        });

        return result;
    }


    $("#show-filter-modal-button").click(function() {
        types = d3.set(
            graph.getNodes().map(function(node) { return node.type; })
        ).values();

        $("#list-of-node-types").empty();

        types.forEach(function(type) {
            var label = $("<label>")
                .addClass("btn btn-default")
                .html(type)
                .appendTo("#list-of-node-types");

            var input = $("<input>")
                .attr({name: type, type: "checkbox"})
                .appendTo(label);

            if (!filteredTypes.has(type)) {
                label.addClass("active");
                input.prop('checked', true);
            }
        });
    });

    $("#filter-button").click(function() {
        filteredTypes = d3.set($("#filter-form input:checkbox:not(:checked)").map(function() { return $(this).attr("name"); }));

        filterFunction = function(node) {
            return !filteredTypes.has(node.type);
        };

        update();
        $("#filter-modal").modal("hide");
    });
});

$("#add-button").click(function () {
    $("#add-error-msg").hide();
    $.ajax({
        type: "GET",
        url: "/add-cluster",
        data: $("#add-form").serialize(),
        success: function(){
            $("#add-modal").modal("hide");
            location.reload();  
        },
        error: function() {
            $("#add-progress").hide();
            $("#add-error-msg").show();
            $("#add-button").prop("disabled", false);
        }
    });
    $("#add-button").prop("disabled", true);
    $("#add-progress").show();
});
