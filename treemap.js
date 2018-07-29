const svgcsstreemap = `
g.journal rect { transition: fill 0.3s, fill-opacity 0.3s; }
g.journal rect.square { stroke: #FFFFFF33; stroke-width: 1; }
g.journal:hover rect.square { fill: #444444; }
g.journal rect.title { fill: rgba(255,255,255,0.33); }
g.journal:hover rect.title { fill-opacity: 1; }
g.journal text { font-size: 10px; fill: #222222; text-align: left; }
g.journal:hover text { fill: #FFFFFF; fill-opacity: 1; }

g.journal.gray:not(:hover) rect.title, g.journal.gray:not(:hover) rect.square { fill: #dddddd; }
g.journal.gray:not(:hover) text { fill-opacity: 0; }

g.journal.clicked rect.title {  fill: #7c7c7c; }
g.journal.clicked rect.square {  fill: #222222; }
g.journal.clicked text { fill: #ffffff;fill-opacity: 1 }

g.inout { pointer-events: none }
g.in path {fill: #FFFFFF; stroke: #FFFFFF;}
g.out path {fill: #333333; stroke: #333333;}
`;

/*
 * Build the chart
 */
function buildchart() {
  results.treemapData = treemap(data.tree);
  results.leavesLookup = new Map();
  results.treemapData
    .leaves()
    .forEach(d => (results.leavesLookup[d.data.id] = d));

  const svg = d3
    .select("svg")
    .attr("width", width)
    .attr("height", height)
    .html(
      `
      <defs>
        <style type="text/css">${svgcss()}${svgcsstreemap}</style>
        ${svgshadowfilter()}
      </defs>
        `
    );

  svg
    .append("rect")
    .attr("id", "main")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "#f0f0f0");

  const vis = svg
    .append("g")
    .attr("id", "vis")
    .attr("transform", `translate(0, ${config.titleHeight})`);

  svg.append("g").attr("id", "maintitle");

  svg.append("g").attr("id", "tooltip");

  function handleMouseOver(d, i) {
    if (clicked === -1 || d.data.id === clicked)
      tooltip(
        "t-" + i,
        width,
        height,
        d.data.longLabel,
        "Eigenfactor: " + cutAfter(d.value, 6)
      );
    else {
      const inArray = data.flowEdges.filter(
        e => e.source === d.data.id && e.target === clicked
      );
      const outArray = data.flowEdges.filter(
        e => e.source === clicked && e.target === d.data.id
      );
      tooltip(
        "t-" + i,
        width,
        height,
        d.data.longLabel,
        "IN:",
        "OUT:",
        cutAfter(inArray.length === 1 ? inArray[0].normalizedWeight : 0, 6),
        cutAfter(outArray.length === 1 ? outArray[0].normalizedWeight : 0, 6)
      );
    }
  }

  function handleMouseOut(d, i) {
    d3.select("#t-" + i).remove();
  }

  const leaf = d3
    .select("g#vis")
    .append("g")
    .classed("leaves", true)
    .selectAll("g")
    .data(results.treemapData.leaves())
    .enter()
    .append("g")
    .classed("journal", true)
    .attr("transform", d => `translate(${d.x0},${d.y0})`)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut);

  leaf
    .append("rect")
    .classed("square", true)
    .attr("id", d => (d.leafUid = DOM.uid("leaf")).id)
    .attr("fill", d => {
      const v = d.data.weight;
      while (d.depth > 1) d = d.parent;
      return getColorByIndexAndWeight({ index: d.id, weight: v });
    })
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0);

  leaf
    .append("rect")
    .classed("title", true)
    .attr("x", 0)
    .attr("y", 0)
    .attr("fill-opacity", d => d.data.weight * 0.8 + 0.2)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", 16);

  leaf
    .append("text")
    .attr("clip-path", d => d.clipUid)
    .attr("fill-opacity", d => d.data.weight * 0.8 + 0.2)
    .selectAll("tspan")
    .data(d => [d])
    .enter()
    .append("tspan")
    .attr("x", 3)
    .attr("y", 12)
    .text(d => d.data.label);

  return add_interaction(svg.node());
}

/*
 * Interactions
 */

function add_interaction(chart) {
  const svg = d3.select(chart);
  const journals = svg.selectAll("g.journal").on("click", click);
  svg.on("click", click);

  const inout = d3
    .select("g#vis")
    .append("g")
    .classed("inout", true)
    .selectAll("g")
    .data(results.treemapData.leaves())
    .enter()
    .append("g")
    .attr("transform", d => {
      let target = cell_center(results.leavesLookup[d.data.id]);
      return `translate(${target})`;
    });

  inout
    .append("g")
    .classed("in", true)
    .attr("transform", "scale(0)")
    .style("opacity", "0")
    .append("path")
    .attr("transform", "rotate(0)")
    .attr("d", arrowShape(1));
  inout
    .append("g")
    .classed("out", true)
    .attr("transform", "scale(0)")
    .style("opacity", "0")
    .append("path")
    .attr("transform", "rotate(0)")
    .attr("d", arrowShape(-1));

  const title = svg.select("g#maintitle");
  title.append("rect").attr("height", config.titleHeight);
  title
    .append("text")
    .attr("transform", `translate(${[9, config.titleHeight - 5]})`);

  return chart;
}

function click(d) {
  d3.event.stopPropagation();
  if (d === undefined || d.data.id === clicked) {
    clicked = -1;
  } else {
    clicked = d.data.id;
  }
  inout();
}

function cell_center(leaf) {
  return [(leaf.x0 + leaf.x1) / 2, (leaf.y0 + leaf.y1) / 2];
}

function arrowShape(sign) {
  return (
    "M" +
    [[0.5, -11], [70, -11], [78, 0], [70, 11], [0.5, 11]]
      .map(d => d.map(e => e * sign))
      .join("L") +
    "Z"
  );
}

function setTitle(title) {
  const text = d3.select("svg #maintitle text");
  text.text(title);
  const w = text.node().getBBox().width;
  d3.select("svg #maintitle rect").attr("width", !w ? 0 : w + 2 * 9);
}

function inout() {
  if (clicked === -1) {
    d3.select("svg .inout")
      .selectAll("g.in, g.out")
      .transition()
      .duration(300)
      .attr("transform", "scale(0)")
      .style("opacity", 0);
    setTitle("");
    d3.select("svg .leaves")
      .selectAll(`g.journal`)
      .classed("gray", false)
      .classed("clicked", false);
    d3.select("svg .leaves")
      .selectAll(`g.journal rect.linked`)
      .classed("linked", false)
      .attr("fill", d =>
        getColorByIndexAndWeight({
          index: +d.parent.parent.id,
          weight: d.data.weight
        })
      );
    return;
  }

  const main = results.leavesLookup[clicked];

  setTitle(main.data.longLabel);

  const links = {
      in: data.flowEdges.filter(d => d.source === clicked),
      out: data.flowEdges.filter(d => d.target === clicked)
    },
    highlighted = new Map();

  // SCALE
  ["in", "out"].forEach(arrow => {
    const weights = new Map();
    const source = arrow == "in" ? "target" : "source";
    links[arrow].forEach(d => {
      weights[d[source]] = +d.normalizedWeight;
      highlighted[d[source]] = true;
    });

    d3.select("svg .inout")
      .selectAll(`g.${arrow}`)
      .transition()
      .duration(300)
      .attr("transform", d => {
        let size = weights[d.data.id];
        return `scale(${size ? 0.1 + size : 0})`;
      })
      .style("opacity", d => (weights[d.data.id] ? 1 : 0));
  });

  d3.select("svg .leaves")
    .selectAll(`g.journal`)
    .classed("gray", d => !highlighted[d.data.id] && d.data.id != clicked)
    .classed("clicked", d => d.data.id == clicked);

  const localWeights = new Map([[main.data.id, 1]]);
  links.in.forEach(l =>
    localWeights.set(
      l.target,
      (localWeights.has(l.target) ? localWeights.get(l.target) : 0) +
        l.normalizedWeight
    )
  );
  links.out.forEach(l =>
    localWeights.set(
      l.source,
      (localWeights.has(l.source) ? localWeights.get(l.source) : 0) +
        l.normalizedWeight
    )
  );
  d3.select("svg .leaves")
    .selectAll(`g.journal`)
    .filter(d => localWeights.has(d.data.id))
    .select("rect")
    .classed("linked", true)
    .attr("fill", d => {
      return getColorByIndexAndWeight({
        index: +d.parent.parent.id,
        weight: localWeights.get(d.data.id)
      });
    });

  // ROTATE
  d3.select("svg .inout")
    .selectAll("path")
    .transition()
    .duration(300)
    .attr("transform", d => {
      const source = cell_center(main),
        target = cell_center(results.leavesLookup[d.data.id]);
      let direction = Math.atan2(source[1] - target[1], source[0] - target[0]);

      if (direction > d.direction + Math.PI) direction -= 2 * Math.PI;
      if (direction < d.direction - Math.PI) direction += 2 * Math.PI;

      d.direction = direction;
      return `rotate(${(direction * 180) / Math.PI})`;
    });
}

/*
 * Build the treemap
 */
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

function treemap(data) {
  return d3
    .treemap()
    .tile(d3.treemapSquarify.ratio(1))
    .size([width, height - config.titleHeight])
    .padding(0)
    .round(false)(
    hierarchy(data)
      .sum(d => d.eigenfactor)
      .sort((a, b) => b.value - a.value)
  );
}
