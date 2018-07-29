const svgcssradial = `
g#links path.link {
  /*stroke: #333;*/
  /*stroke-opacity: 0.2;*/
  /*stroke-width: 0.2;*/
  fill: none;
  pointer-events: none;
}
g#labels text.label { font-family: flamalightregular; font-size: 13px; }

g#innerArcs path.innerArc.clicked { fill: #222222 }
g#innerArcs path.innerArc.unlinked { fill: #DDDDDD }
g#innerArcs path.innerArc:hover { fill: #444444; }

g#outerArcs path.outerArc.clicked { fill: #222222 }
g#outerArcs path.outerArc:hover { fill: #444444; }
g#outerArcs path.outerArc.unlinked { fill: #DDDDDD; }
`;

config.titleHeight = 35;

/*
 * Build the chart
 */
function buildchart() {
  results.radius = Math.min(width, height) / 2 - 40;
  const initialAngle = Math.PI / 5; /* TODO: understand why */
  results.maxLinks = 1000;

  results.radialData = centerChildNodes(
    stratifyTree(data.tree).sum(d => d.eigenfactor)
  );
  results.radialData = addAngleAndRadius(
    results.radialData,
    results.radius - 10,
    initialAngle,
    results.radialData.value
  );
  results.radialData = results.radialData.each(addNodeColor);

  results.leavesData = results.radialData.leaves();
  results.groupsData = results.radialData
    .descendants()
    .filter(d => d.depth == 2);

  results.radialDataLookup = results.radialData.descendants().reduce((a, c) => {
    a[c.data.id] = c;
    return a;
  }, {});
  results.linksData = data.flowEdges.map(link => {
    return {
      source: results.radialDataLookup[link.source],
      target: results.radialDataLookup[link.target],
      weight: link.weight,
      normalizedWeight: link.normalizedWeight
    };
  });
  results.linksLookup = new Map();

  const svg = d3
    .select("svg")
    .attr("width", width)
    .attr("height", height + config.titleHeight)
    .html(
      `
      <defs>
        <style type="text/css">${svgcss()}${svgcssradial}</style>
        ${svgshadowfilter()}
      </defs>
      `
    );

  svg
    .append("rect")
    .attr("id", "main")
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill", "#f0f0f0")
    .attr("fill-opacity", 0)
    .on("click", goToNormalState);

  const graph = svg
    .append("g")
    .attr("id", "vis")
    .attr("transform", `translate(${[width / 2, height / 2]}) scale(0.8)`);

  const title = svg.append("g").attr("id", "maintitle");
  title.append("rect").attr("height", config.titleHeight);
  title
    .append("text")
    .attr("transform", `translate(${[9, config.titleHeight - 7]})`);

  svg.append("g").attr("id", "tooltip");

  goToNormalState();

  return svg.node();
}

/*
 * Interaction functions
 */

function handleMouseOver(d, i) {
  // Ugly, will fix later
  const label = "longLabel" in d.data ? d.data.longLabel : d.data.label;
  const value =
    "eigenfactor" in d.data ? d.data.eigenfactor : d.data.parentEigenfactor;

  if (clicked === -1 || clicked.data.id === d.data.id) {
    tooltip(
      "t-" + i,
      width,
      height,
      label,
      "Eigenfactor: " + cutAfter(value, 6)
    );
  } else {
    const inout = getInOut(d, clicked);
    tooltip(
      "t-" + i,
      width,
      height,
      label,
      "IN:",
      "OUT:",
      cutAfter(inout.in, 6),
      cutAfter(inout.out, 6)
    );
  }
}

function calcInDepth3(source, target) {
  const v = data.flowEdges
    .filter(l => l.source === source.data.id && l.target === target.data.id)
    .map(l => l.normalizedWeight);
  return v.length === 1 ? v[0] : 0;
}

function getInOut(source, target) {
  const lo = results.linksLookup;
  const sId = source.data.id;
  const tId = target.data.id;

  if (!lo.has(sId)) lo.set(sId, new Map());

  if (!lo.get(sId).has(tId)) {
    if (lo.has(tId) && lo.get(tId).has(sId)) {
      lo.get(sId).set(tId, {
        in: lo.get(tId).get(sId).out,
        out: lo.get(tId).get(sId).in
      });
    } else if (source.depth === 3 && target.depth === 3) {
      lo.get(sId).set(tId, {
        in: calcInDepth3(source, target),
        out: calcInDepth3(target, source)
      });
    } else if ("children" in target) {
      lo.get(sId).set(
        tId,
        target.children.reduce(
          (a, c) => {
            const inout = getInOut(source, c);
            a.in += inout.in;
            a.out += inout.out;
            return a;
          },
          { in: 0, out: 0 }
        )
      );
    } else {
      const inout = getInOut(target, source);
      lo.get(sId).set(tId, {
        in: inout.out,
        out: inout.in
      });
    }
  }

  return lo.get(sId).get(tId);
}

function handleMouseOut(d, i) {
  d3.select("#t-" + i).remove();
}

function handleClick(arc, i) {
  /* TODO: Be more consistent and careful with the state management.
   * Maybe use an array, or a null node placeholder */
  if (clicked !== -1 && arc.data.id === clicked.data.id) {
    goToNormalState();
  } else {
    goToSelectedState(arc);
  }
}

function goToNormalState() {
  clicked = -1;
  setTitle("");

  const g = d3.select("g#vis");
  g.select("g#innerArcs").remove();
  g.select("g#outerArcs").remove();
  g.select("g#labels").remove();
  g.select("g#links").remove();

  drawOuterArcs(
    g.append("g").attr("id", "outerArcs"),
    results.groupsData,
    results.radius
  );
  drawInnerArcs(
    g.append("g").attr("id", "innerArcs"),
    results.leavesData,
    results.radius
  );
  drawLabels(
    g.append("g").attr("id", "labels"),
    results.groupsData
      .filter(
        group =>
          group.data.parentEigenfactor > 0.005 &&
          group.data.label !== "NO SUGGESTION"
      ) // show label if large enough, and there is in fact one
      .map(d => {
        return {
          angle: (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360,
          text: d.data.label,
          fill: "#888888"
        };
      }),
    results.radius
  );
  drawLinks(
    g.append("g").attr("id", "links"),
    results.linksData
      .sort((a, b) => b.normalizedWeight > a.normalizedWeight)
      .slice(0, results.maxLinks),
    getGrayLinkColor
  );
}

function goToSelectedState(arc) {
  if (arc.depth === 3) selectInnerArc(arc);
  else selectOuterArc(arc);
  clicked = arc;
}

function selectInnerArc(arc) {
  setTitle(arc.data.longLabel);

  const innerArcs = d3.selectAll("svg .innerArc");
  innerArcs.classed("clicked", d => d.data.id === arc.data.id);

  const localWeights = new Map([[arc.data.id, 1]]);
  data.flowEdges
    .filter(link => link.source === arc.data.id)
    .forEach(l =>
      localWeights.set(
        l.target,
        (localWeights.has(l.target) ? localWeights.get(l.target) : 0) +
          l.normalizedWeight
      )
    );
  data.flowEdges
    .filter(link => link.target === arc.data.id)
    .forEach(l =>
      localWeights.set(
        l.source,
        (localWeights.has(l.source) ? localWeights.get(l.source) : 0) +
          l.normalizedWeight
      )
    );
  innerArcs.classed(
    "unlinked",
    d => !localWeights.has(d.data.id) && d.data.id !== arc.data.id
  );
  innerArcs.filter(d => localWeights.has(d.data.id)).attr("fill", d => {
    return getColorByIndexAndWeight({
      index: +d.parent.parent.id,
      weight: localWeights.get(d.data.id),
      MIN_SAT: 0.4,
      MAX_SAT: 0.95,
      MIN_BRIGHTNESS: 0.8,
      MAX_BRIGHTNESS: 0.5
    });
  });

  /* Outer arcs */
  d3.select("g#outerArcs")
    .selectAll(".outerArc")
    .classed("unlinked", true);

  /* Links */
  const links = d3.select("g#links").remove();
  drawLinks(
    d3
      .select("g#vis")
      .append("g")
      .attr("id", "links"),
    results.linksData.filter(
      l => l.source.data.id === arc.data.id || l.target.data.id === arc.data.id
    ),
    link => {
      const color = d3.rgb(
        getColorByIndexAndWeight({
          index: +link.source.parent.parent.id,
          weight: link.normalizedWeight,
          MIN_SAT: 0.4,
          MAX_SAT: 0.95,
          MIN_BRIGHTNESS: 0.8,
          MAX_BRIGHTNESS: 0.5
        })
      );
      color.opacity = 0.3 + 0.6 * link.normalizedWeight;
      /* TODO: reproduce the Flare MULTIPLY blend mode to darken */
      return color.darker();
    }
  );

  /* Labels */
  d3.select("g#labels").remove();
  drawLabels(
    d3
      .select("g#vis")
      .append("g")
      .attr("id", "labels"),
    results.leavesData
      .filter(d => {
        return localWeights.has(d.data.id) || d.data.id === arc.data.id;
      })
      .map(d => {
        const brightness =
          221 - Math.min(153, Math.floor(localWeights.get(d.data.id) * 153));
        const fill = d3.rgb(brightness, brightness, brightness).toString();
        return {
          angle: (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360,
          text: d.data.label,
          fill: d.data.id === arc.data.id ? "#222222" : fill
        };
      }),
    results.radius
  );
}

function selectOuterArc(arc) {
  setTitle(arc.data.label);

  const childrenIds = arc.children.map(e => e.data.id);

  const innerArcs = d3.selectAll("g#innerArcs .innerArc");
  const localWeights = new Map([[arc.data.id, 1]]);
  data.flowEdges
    .filter(link => childrenIds.includes(link.source))
    .forEach(l =>
      localWeights.set(
        l.target,
        (localWeights.has(l.target) ? localWeights.get(l.target) : 0) +
          l.normalizedWeight
      )
    );
  data.flowEdges
    .filter(link => childrenIds.includes(link.target))
    .forEach(l =>
      localWeights.set(
        l.source,
        (localWeights.has(l.source) ? localWeights.get(l.source) : 0) +
          l.normalizedWeight
      )
    );
  innerArcs.classed("unlinked", d => !localWeights.has(d.data.id));
  innerArcs.filter(d => localWeights.has(d.data.id)).attr("fill", d => {
    return getColorByIndexAndWeight({
      index: +d.parent.parent.id,
      weight: localWeights.get(d.data.id),
      MIN_SAT: 0.4,
      MAX_SAT: 0.95,
      MIN_BRIGHTNESS: 0.8,
      MAX_BRIGHTNESS: 0.5
    });
  });

  // Outer arcs
  d3.select("g#outerArcs")
    .selectAll(".outerArc")
    .classed("unlinked", d => d.data.id !== arc.data.id)
    .classed("clicked", d => d.data.id === arc.data.id);

  // Links
  const links = d3.select("g#links").remove();
  drawLinks(
    d3
      .select("g#vis")
      .append("g")
      .attr("id", "links"),
    results.linksData.filter(
      l =>
        childrenIds.includes(l.source.data.id) ||
        childrenIds.includes(l.target.data.id)
    ),
    link => {
      const color = d3.rgb(
        getColorByIndexAndWeight({
          index: +link.source.parent.parent.id,
          weight: link.localWeight,
          MIN_SAT: 0.4,
          MAX_SAT: 0.95,
          MIN_BRIGHTNESS: 0.8,
          MAX_BRIGHTNESS: 0.5
        })
      );
      color.opacity = 0.3 + 0.6 * link.localWeight;
      // TODO: reproduce the Flare MULTIPLY blend mode to darken
      return color.darker();
    }
  );

  // Labels
  d3.select("g#labels").remove();
  const g = d3
    .select("g#vis")
    .append("g")
    .attr("id", "labels");
  drawLabels(
    g,
    results.groupsData.filter(d => d.data.id === arc.data.id).map(d => {
      return {
        angle: (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360,
        text: d.data.label,
        fill: "#222222"
      };
    }),
    results.radius
  );
  drawLabels(
    g,
    results.leavesData
      .filter(d => {
        return localWeights.has(d.data.id) && d.parent.data.id !== arc.data.id;
      })
      .map(d => {
        const brightness =
          221 - Math.min(153, Math.floor(localWeights.get(d.data.id) * 153));
        const fill = d3.rgb(brightness, brightness, brightness).toString();
        return {
          angle: (((180 / Math.PI) * (d.startAngle + d.endAngle)) / 2) % 360,
          text: d.data.label,
          fill: fill
        };
      }),
    results.radius
  );
}

function setTitle(title) {
  const text = d3.select("svg #maintitle text");
  text.text(title);
  const w = text.node().getBBox().width;
  d3.select("svg #maintitle rect").attr("width", !w ? 0 : w + 2 * 9);
}

/*
 * Graphical functions
 */

function drawInnerArcs(g, data, radius) {
  return g
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .classed("innerArc", true)
    .attr("id", d => d.data.id)
    .attr("d", innerArc(radius))
    .attr("fill", d => d.color)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut)
    .on("click", handleClick);
}

function drawOuterArcs(g, data, radius) {
  return g
    .selectAll("path")
    .data(data)
    .enter()
    .append("path")
    .classed("outerArc", true)
    .attr("id", d => d.data.id)
    .attr("d", outerArc(radius))
    .attr("fill", d => d.color)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut)
    .on("click", handleClick);
}

function drawLinks(g, linksData, colorFn) {
  return g
    .selectAll("path")
    .data(linksData)
    .enter()
    .append("path")
    .attr("class", "link")
    .attr("d", link => {
      const path = moveEdgePoints(link.source.path(link.target));
      return line(path);
    })
    .attr("stroke-width", d => 1 + 5 * d.normalizedWeight)
    .attr("stroke", d => colorFn(d));
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

function drawLabels(g, labels, radius) {
  return g
    .selectAll("text")
    .data(labels)
    .enter()
    .append("text")
    .attr("class", "label")
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
    }) /* TODO: set the exact radius */
    .attr("text-anchor", function(d) {
      return d.angle < 180 ? "start" : "end";
    })
    .attr("fill", d => d.fill)
    .text(function(d) {
      return d.text;
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
  node.angleWidth = (node.value / maxValue) * Math.PI;
  node.padAngle = node.angleWidth > 0.003 ? 0.0015 : node.angleWidth;
  node.startAngle = startAngle;
  node.endAngle = startAngle + 2 * node.angleWidth;
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

function getGrayLinkColor(link) {
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
