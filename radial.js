const svgcssradial = `
.link {
  stroke: #333;
  stroke-opacity: 0.2;
  stroke-width: 0.2;
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
  results.radialData = centerChildNodes(radial(data.tree, radius + 10));
  results.innerData = centerChildNodes(hierarchy(data.tree));
  results.leavesLookup = new Map();
  results.radialData
    .leaves()
    .forEach(d => (results.leavesLookup[d.data.id] = d));

  const svg = d3
    .select("svg")
    .attr("width", width)
    .attr("height", height + config.titleHeight)
    .html(
      `
      <defs>
      <style type="text/css">${svgcss()}${svgcssradial}</style>
        </defs>
        `
    )
    .append("g")
    .attr("transform", `translate(0, ${config.titleHeight})`);

  const graph = svg
    .append("g")
    .attr("transform", `translate(${[width / 2, height / 2]}) scale(0.8)`);

  const link = graph.append("g").selectAll(".link"),
    node = graph.append("g").selectAll(".node");

  const leavesData = results.radialData.leaves();
  const groupsData = results.radialData
    .descendants()
    .filter(d => d.depth == 2)
    .map(d => ((d.yy = (3 / 2) * d.y), d));
  const outerArcsData = createInnerArcsData(groupsData);
  const innerArcsData = createInnerArcsData(results.radialData.leaves());

  drawOuterArcs(graph.append("g"), outerArcsData, radius);
  drawInnerArcs(graph.append("g"), innerArcsData, radius);
  //drawCategories(node)
  drawLabels(node, outerArcsData, radius);
  drawLinks(link, leavesData);

  return svg.node();
}

/*
 * Graphical functions
 */

function drawInnerArcs(node, data, radius) {
  const arc = innerArc(radius);
  return node
    .selectAll(".innerArc")
    .data(data)
    .enter()
    .append("path")
    .classed("innerArc", true)
    .attr("d", d => arc(d))
    .attr("fill", d => d.color);
}

function drawOuterArcs(node, data, radius) {
  const arc = outerArc(radius);
  return node
    .selectAll(".outerArc")
    .data(data)
    .enter()
    .append("path")
    .classed("outerArc", true)
    .attr("d", d => arc(d))
    .attr("fill", d => d.color)
    .on("click", d => console.log(d.data.data.label));
}
function drawLinks(link, leaves) {
  return link
    .data(packageImports(leaves)) // todo: links
    .enter()
    .append("path")
    .each(function(d) {
      (d.source = d[0]), (d.target = d[d.length - 1]);
    })
    .attr("class", "link")
    .attr("d", line);
}

function drawLabels(node, leaves, radius) {
  console.log(leaves);
  // show label if large enough, and there is in fact one
  leaves = leaves
    .filter(
      node =>
        node.data.data.parentEigenfactor > 0.005 &&
        node.data.data.label !== "NO SUGGESTION"
    )
    .map(
      d => (
        (d.angle = (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360),
        d
      )
    );
  return node
    .data(leaves)
    .enter()
    .append("text")
    .attr("class", "node")
    .attr("dy", "0.31em")
    .attr("transform", function(d) {
      return (
        "rotate(" +
        (d.angle - 90) +
        ")translate(" +
        (d.data.yy + 8) +
        ",0)" +
        (d.angle < 180 ? "" : "rotate(180)")
      );
    })
    .attr("text-anchor", function(d) {
      return d.angle < 180 ? "start" : "end";
    })
    .text(function(d) {
      return d.data.data.label;
    });
}

/* Graphical functions for small elements */

function innerArc(radius) {
  return d3
    .arc()
    .outerRadius(radius)
    .innerRadius(radius - 10);
}

function outerArc(radius) {
  return innerArc(radius + 11);
}

const line = d3
  .radialLine()
  .curve(d3.curveBundle.beta(0.85))
  .radius(function(d) {
    return d.y;
  })
  .angle(function(d) {
    return (d.x / 180) * Math.PI;
  });

/*
 * DATA
 *
 * Build the hierarchical edge bundling graph
 * https://bl.ocks.org/mbostock/7607999
 *
 */
function createInnerArcsData(leavesData) {
  return calcInnerArcsAngles(
    leavesData.map((l, i) => {
      return {
        data: l,
        value: l.value,
        padAngle: 0,
        index: i,
        startAngle: 0,
        endAngle: 0,
        color: getColor(l)
      };
    })
  );
}

function getColor(leaf) {
  let color = getColorByIndexAndWeight({
    index: leaf.depth === 3 ? +leaf.parent.parent.id : +leaf.parent.id,
    weight: leaf.depth === 3 ? leaf.data.weight : leaf.value,
    MIN_SAT: 0.4,
    MAX_SAT: 0.95,
    MIN_BRIGHTNESS: 0.8,
    MAX_BRIGHTNESS: 0.5
  });
  if (leaf.depth === 2) color = fadeColor(color);
  return color;
}

function fadeColor(color) {
  const hsvColor = d3.hsv(color);
  return d3.hsv(hsvColor.h, 0.2, 0.8);
}

function calcInnerArcsAngles(arcs) {
  const calcArcs = arcs.reduce(
    (a, c) => {
      c.startAngle = a.sumValues + a.shiftValue;
      a.sumValues += c.value;
      c.endAngle = a.sumValues + a.shiftValue;
      a.arcs.push(c);
      return a;
    },
    {
      arcs: [],
      sumValues: 0,
      shiftValue: 0.03 // Fix this - I'm missing something
    }
  );
  return calcArcs.arcs.map(c => {
    c.startAngle = (2 * Math.PI * c.startAngle) / calcArcs.sumValues;
    c.endAngle = (2 * Math.PI * c.endAngle) / calcArcs.sumValues;
    c.padAngle =
      c.endAngle - c.startAngle > 0.006
        ? 0.0015
        : (c.endAngle - c.startAngle) / 2;
    return c;
  });
}

function hierarchy(tree) {
  return d3
    .stratify()
    .id(function(d) {
      return d.path;
    })
    .parentId(function(d) {
      return d.parentPath;
    })(tree);
}

function radial(data, innerRadius) {
  /*const diameter = 960,
    radius = diameter / 2,
    innerRadius = radius - 120;*/

  const cluster = d3.cluster().size([360, innerRadius]),
    hier = hierarchy(data).sum(d => d.eigenfactor);
  //.sort((a, b) => b.value - a.value);
  cluster(hier);

  return hier;
}

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
