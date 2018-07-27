const svgcssradial = `
.link {
  /*stroke: #333;*/
  /*stroke-opacity: 0.2;*/
  /*stroke-width: 0.2;*/
  fill: none;
  pointer-events: none;
}
path.innerArc:hover { fill: #444444; }
path.outerArc:hover { fill: #444444; }

text.node { fill: #888888; font-family: flamalightregular; font-size: 13px; }
`;

config.titleHeight = 35;

/*
 * Build the chart
 */
function buildchart() {
  const radius = Math.min(width, height) / 2 - 40;
  const initialAngle = Math.PI / 5; /* TODO: understand why */

  results.radialData = centerChildNodes(
    stratifyTree(data.tree).sum(d => d.eigenfactor)
  );
  results.radialData = addAngleAndRadius(
    results.radialData,
    radius,
    initialAngle,
    results.radialData.value
  );
  results.radialData = results.radialData.each(addNodeColor);

  const leavesData = results.radialData.leaves();
  const groupsData = results.radialData
    .descendants()
    .filter(d => d.depth == 2)
    .map(d => ((d.yy = (3 / 2) * d.y), d));

  const radialDataLookup = results.radialData.descendants().reduce((a, c) => {
    a[c.data.id] = c;
    return a;
  }, {});
  const linksData = data.flowEdges.map(link => {
    link.source = radialDataLookup[link.source];
    link.target = radialDataLookup[link.target];
    return link;
  });

  const svg = d3
    .select("svg")
    .attr("width", width)
    .attr("height", height + config.titleHeight)
    .html(
      `
      <defs>
      <style type="text/css">${svgcss()}${svgcssradial}</style>
      <filter id="drop-shadow">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.5">
      </feDropShadow>
      </filter>
      </defs>
      `
    )
    .append("g")
    .attr("transform", `translate(0, ${config.titleHeight})`);

  const graph = svg
    .append("g")
    .attr("id", "radial")
    .attr("transform", `translate(${[width / 2, height / 2]}) scale(0.8)`);

  const link = graph.append("g").selectAll(".link"),
    node = graph.append("g").selectAll(".node");

  drawOuterArcs(graph.append("g"), groupsData, radius);
  drawInnerArcs(graph.append("g"), leavesData, radius);
  drawLabels(node, groupsData, radius);
  drawLinks(link, linksData, 1000);

  return svg.node();
}

/*
 * Interaction functions
 */

function handleMouseOver(d, i) {
  const svg = d3.select("g#radial");
  const cursor = d3.mouse(this);

  // Ugly, will fix later
  const label = "longLabel" in d.data ? d.data.longLabel : d.data.label;
  const value =
    "eigenfactor" in d.data ? d.data.eigenfactor : d.data.parentEigenfactor;

  d3.selectAll(".tooltip").remove();

  const g = svg
    .append("g")
    .classed("tooltip", true)
    .attr("id", "t-" + i);

  const rect = g
    .append("rect")
    .classed("background", true)
    .attr("x", 0)
    .attr("y", 0)
    .style("filter", "url(#drop-shadow)");

  const text = g
    .append("text")
    .classed("text", true)
    .attr("x", 0)
    .attr("y", 0);

  const tspan1 = text
    .append("tspan")
    .classed("title", true)
    .attr("x", 4)
    .attr("dy", "1em")
    .text(label);

  text
    .append("tspan")
    .classed("detail", true)
    .attr("x", 4)
    .attr("dy", "1em")
    .text("Eigenfactor: " + cutAfter(value, 6));

  const bbox = text.node().getBBox();
  rect.attr("width", bbox.width + 8).attr("height", bbox.height);

  /* Manage the bottom and right edges */
  const x =
    cursor[0] -
    (cursor[0] + bbox.width + 8 + 2 > width / 2 ? bbox.width + 8 : 0);
  const y =
    cursor[1] +
    (d.data.y + cursor[1] + bbox.height + 26 + 2 > height - config.titleHeight
      ? -bbox.height - 6
      : 26);

  g.attr("transform", `translate(${x},${y})`);
}

function handleMouseOut(d, i) {
  d3.select("#t-" + i).remove();
}

/*
 * Graphical functions
 */

function drawInnerArcs(node, data, radius) {
  return node
    .selectAll(".innerArc")
    .data(data)
    .enter()
    .append("path")
    .classed("innerArc", true)
    .attr("d", innerArc(radius))
    .attr("fill", d => d.color)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut);
}

function drawOuterArcs(node, data, radius) {
  return node
    .selectAll(".outerArc")
    .data(data)
    .enter()
    .append("path")
    .classed("outerArc", true)
    .attr("d", outerArc(radius))
    .attr("fill", d => d.color)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut);
}

function drawLinks(link, linksData, maxLinks) {
  return link
    .data(
      linksData
        .sort((a, b) => b.normalizedWeight > a.normalizedWeight)
        .slice(0, maxLinks === undefined ? linksData.length : maxLinks)
    )
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("d", link => {
      const path = moveEdgePoints(link.source.path(link.target));
      return line(path);
    })
    .attr("stroke-width", d => (1 + 5 * d.normalizedWeight) / 2)
    .attr("stroke", d => getGreyLinkColor(d));
}

function moveEdgePoints(path) {
  const source = path[0];
  const target = path[path.length - 1];
  let delta = ((source.centerAngle - target.centerAngle) / (2 * Math.PI)) % 1;
  if (delta < 0) delta += 1;
  path[0] = {
    radius: source.radius,
    centerAngle: source.centerAngle + source.angleWidth * (delta - 0.5)
  };
  path[path.length - 1] = {
    radius: target.radius,
    centerAngle: target.centerAngle + target.angleWidth * (0.5 - delta)
  };
  return path;
}

function drawLabels(g, nodes, radius) {
  // show label if large enough, and there is in fact one
  nodes = nodes
    .filter(
      node =>
        node.data.parentEigenfactor > 0.005 &&
        node.data.label !== "NO SUGGESTION"
    )
    .map(
      d => (
        (d.angle = (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360),
        d
      )
    );
  return g
    .data(nodes)
    .enter()
    .append("text")
    .attr("class", "node")
    .attr("dy", "0.31em")
    .attr("transform", function(d) {
      return (
        "rotate(" +
        (d.angle - 90) +
        ")translate(" +
        (radius + 20) +
        ",0)" +
        (d.angle < 180 ? "" : "rotate(180)")
      );
    })
    .attr("text-anchor", function(d) {
      return d.angle < 180 ? "start" : "end";
    })
    .text(function(d) {
      return d.data.label;
    });
}

/* Graphical functions for basic elements */

function innerArc(radius) {
  return d3
    .arc()
    .outerRadius(radius)
    .innerRadius(radius - 10);
}

function outerArc(radius) {
  return d3
    .arc()
    .outerRadius(radius + 11)
    .innerRadius(radius + 1);
}

const line = d3
  .radialLine()
  .curve(d3.curveBundle.beta(0.8))
  .radius(d => d.radius)
  .angle(d => d.centerAngle);

/*
 * DATA
 *
 * Build the hierarchical edge bundling graph
 * https://bl.ocks.org/mbostock/7607999
 *
 */
function addAngleAndRadius(node, radius, startAngle, maxValue) {
  /* Add angles and radius to current node */
  node.startAngle = startAngle;
  node.endAngle = startAngle + (node.value / maxValue) * 2 * Math.PI;
  node.angleWidth = ((node.endAngle - node.startAngle) / 2) % (2 * Math.PI);
  node.padAngle = node.angleWidth > 0.003 ? 0.0015 : node.angleWidth;
  node.centerAngle = (node.endAngle + node.startAngle) / 2;
  node.radius = (radius * node.depth) / (node.depth + node.height);

  /* Descend in the tree */
  if ("children" in node) {
    node.children = node.children.map((n, i) =>
      addAngleAndRadius(
        n,
        radius,
        i === 0 ? startAngle : node.children[i - 1].endAngle,
        maxValue
      )
    );
  }

  return node;
}

function addNodeColor(node) {
  if (node.depth === 0) return node;
  node.color = getColorByIndexAndWeight({
    index: node.depth === 3 ? +node.parent.parent.id : +node.parent.id,
    weight: node.depth === 3 ? node.data.weight : node.value,
    MIN_SAT: 0.4,
    MAX_SAT: 0.95,
    MIN_BRIGHTNESS: 0.8,
    MAX_BRIGHTNESS: 0.5
  });
  if (node.depth === 2) node.color = fadeColor(node.color);

  return node;
}

function getGreyLinkColor(link) {
  const brightness = 56 - Math.floor(56 * Math.sqrt(link.normalizedWeight));
  const alpha = Math.sqrt(link.normalizedWeight) * 0.3 + 0.02;
  return d3.rgb(brightness, brightness, brightness, alpha).toString();
}

function fadeColor(color) {
  const hsvColor = d3.hsv(color);
  return d3.hsv(hsvColor.h, 0.2, 0.8);
}

const stratifyTree = d3
  .stratify()
  .id(d => d.path)
  .parentId(d => d.parentPath);

// Return a list of imports for the given array of nodes.
function packageImports(nodes) {
  var map = {},
    imports = [];

  // Compute a map from name to node.
  nodes.forEach(function(d) {
    map[d.data.path] = d;
  });

  // For each import, construct a link from the source to target node.
  nodes.forEach(function(d) {
    if (d.data.path)
      nodes
        .slice(0, 2) // todo: select the right nodes :-)
        .map(d => d.data.path)
        .forEach(function(i) {
          imports.push(map[d.data.path].path(map[i]));
        });
  });
  return imports;
}

function centerChildNodes(nodes) {
  nodes.each(node => {
    if ("children" in node) {
      const newChildren = [];
      let i = 1;
      while (node.children.length > 0) {
        if (i < node.children.length) {
          // voodoo!
          newChildren.push(
            node.children.splice(
              Math.max(0, node.children.length - 1 - i),
              1
            )[0]
          );
        } else {
          newChildren.push(node.children.shift());
        }
        i++;
      }
      node.children = newChildren;
    }
  });
  return nodes;
}
