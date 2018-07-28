const svgcsssankey = `
svg.sankey {margin-left: 30px}
svg.sankey g.journals g.journal.clicked rect.node,
svg.sankey g.journals g.journal:hover rect.node {fill: #222222}
svg.sankey g.journals g.journal:hover linearGradient.gradient stop,
svg.sankey g.journals g.journal.clicked linearGradient.gradient stop {stop-color: #222222}
svg.sankey text.title {font-family: flamalightregular, sans-serif; font-size: 18px; fill: #BBBBBB; text-align: left}
`;

const margin = 0.006;
const titleHeight = 20;

/*
 * Build the chart
 */
function buildchart() {
  const sankeyWidth = width - 60;
  results.nodes = createNodes(
    data.trees,
    data.years,
    height,
    sankeyWidth,
    titleHeight
  );
  results.yearTitles = createYearTitles(results.nodes, titleHeight);
  results.journals = createJournals(results.nodes);

  const svg = d3
    .select("svg")
    .attr("width", sankeyWidth)
    .attr("height", height)
    .classed("sankey", true)
    .html(
      `
      <defs>
      <style type="text/css">${svgcss()}${svgcsssankey}</style>
      <filter id="drop-shadow">
      <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.5">
      </feDropShadow>
      </filter>
      </defs>
      `
    )
    .append("g")
    .attr("transform", `translate(0, ${config.titleHeight})`);

  /* Background rectangle to capture clicks. Maybe there is a better solution */
  svg
    .append("rect")
    .classed("background", true)
    .attr("width", "100%")
    .attr("height", "100%")
    .attr("fill-opacity", 0)
    .data([{ class: "background" }])
    .on("click", goToNormalState);

  function handleMouseOver(d, i) {
    const cursor = d3.mouse(this);
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
      .text(d.longLabel);

    text
      .append("tspan")
      .classed("detail", true)
      .attr("x", 4)
      .attr("dy", "1em")
      .text("Eigenfactor in " + d.year + ": " + cutAfter(d.eigenfactor, 6));

    const bbox = text.node().getBBox();
    const svgBbox = d3
      .select("svg.sankey")
      .node()
      .getBBox();
    rect.attr("width", bbox.width + 8).attr("height", bbox.height);

    /* Manage the bottom and right edges */
    const x =
      d.x0 +
      cursor[0] -
      (d.x0 + cursor[0] + bbox.width + 8 + 2 > svgBbox.width
        ? bbox.width + 8
        : 0);
    const y =
      d.y0 +
      cursor[1] +
      (d.y0 + cursor[1] + bbox.height + 26 + 2 >
      svgBbox.height - config.titleHeight
        ? -bbox.height - 6
        : 26);

    g.attr("transform", `translate(${x},${y})`);
  }

  function handleMouseOut(d, i) {
    d3.select("#t-" + i).remove();
  }

  const labels = svg
    .selectAll("text")
    .data(results.yearTitles)
    .enter()
    .append("text")
    .classed("title", true)
    .attr("x", d => d.x0)
    .attr("y", d => d.y0)
    .text(d => d.text);

  const journals = svg
    .append("g")
    .classed("journals", true)
    .selectAll("g")
    .data(results.journals)
    .enter()
    .append("g")
    .classed("journal", true)
    .attr("id", d => d.journalId);

  const node = journals
    .selectAll("rect")
    .data(d => d.nodes)
    .enter()
    .append("rect")
    .classed("node", true)
    .attr("transform", d => `translate(${d.x0},${d.y0})`)
    .attr("fill", d => d.normalColor)
    .attr("width", d => d.x1 - d.x0)
    .attr("height", d => d.y1 - d.y0)
    .on("mousemove", handleMouseOver)
    .on("mouseout", handleMouseOut);

  const link = journals
    .selectAll("path")
    .data(d => d.links)
    .enter()
    .append("path")
    .classed("link", true)
    .attr("fill", d => "url(#" + d.gradient.gradientId + ")")
    .attr("d", d => d.d)
    .on("click", goToNormalState);

  const gradient = journals
    .selectAll("linearGradient")
    .data(d => d.links.map(l => l.gradient))
    .enter()
    .append("linearGradient")
    .classed("gradient", true)
    .attr("id", d => d.gradientId)
    .attr("gradientUnits", "userSpaceOnUse")
    .attr("x1", d => d.x1)
    .attr("x2", d => d.x2)
    .selectAll("stop")
    .data(d => [
      {
        offset: "0%",
        normalColor: d.normalColor1,
        fadedColor: d.fadedColor1,
        opacity: d.opacity1
      },
      {
        offset: "100%",
        normalColor: d.normalColor2,
        fadedColor: d.fadedColor2,
        opacity: d.opacity2
      }
    ])
    .enter()
    .append("stop")
    .attr("offset", function(d) {
      return d.offset;
    })
    .attr("stop-color", function(d) {
      return d.normalColor;
    })
    .attr("stop-opacity", function(d) {
      return d.opacity;
    });

  return add_interaction(svg.node());
}

/*
 * Interactions
 */

function add_interaction(chart) {
  const svg = d3.select(chart);
  const journals = svg.selectAll("g.journal rect.node").on("click", click);

  const title = svg
    .append("g")
    .classed("maintitle", true)
    .attr("transform", `translate(${[0, -config.titleHeight]})`);
  title.append("rect").attr("height", config.titleHeight);
  title
    .append("text")
    .attr("transform", `translate(${[9, config.titleHeight - 7]})`);

  return chart;
}

function click(node) {
  /* TODO: Be more consistent and careful with the state management.
   * Maybe use an array, or a null node placeholder */
  if (node.year === clicked.year && node.journalId === clicked.journalId) {
    goToNormalState();
  } else {
    goToSelectedState(node);
  }
}

function setTitle(title) {
  const text = d3.select("svg .maintitle text");
  text.text(title);
  const w = text.node().getBBox().width;
  d3.select("svg .maintitle rect").attr("width", !w ? 0 : w + 2 * 9);
}

function goToNormalState() {
  clicked = -1;
  setTitle("");
  d3.select("svg .journals")
    .selectAll(`g.journal.clicked`)
    .classed("clicked", false);
  unfadeFadedJournals();
}

function goToSelectedState(node) {
  fadeOtherClusters(node.journalClusterIds); /* TODO: see if we can optimize */
  selectNode(node);
  clicked = node;
}

function unfadeFadedJournals() {
  const fadedJournals = d3.select("svg .journals").selectAll(`g.journal.faded`);
  fadedJournals.selectAll("rect.node").attr("fill", d => d.normalColor);
  fadedJournals
    .selectAll("linearGradient stop")
    .attr("stop-color", d => d.normalColor);
  fadedJournals.classed("faded", false);
}

function selectNode(node) {
  setTitle(node.longLabel + " (" + node.year + ")");

  d3.select("svg .journals")
    .selectAll(`g.journal`)
    .classed("clicked", d => d.journalId === node.journalId);
}

function fadeOtherClusters(clusterIds) {
  /* Here we might be more subtil, only unfading/fading the journals
   * which state has changed. */
  unfadeFadedJournals();

  const fadedJournals = d3
    .select("svg .journals")
    .selectAll(`g.journal`)
    .filter(d => !clusterIds.some(e => d.clusterIds.includes(e)))
    .classed("faded", true);

  /* Send the faded links to the back of the scene */
  fadedJournals.lower();

  fadedJournals.selectAll("rect.node").attr("fill", d => d.fadedColor);

  fadedJournals
    .selectAll("linearGradient stop")
    .attr("stop-color", d => d.fadedColor);
}

/*
 * Build the sankey
 */

function createJournals(nodes) {
  return createNodesByJournalId(nodes).map(l => {
    l.links = createLinks(l.nodes);
    l.clusterIds = [...l.clusterIds.keys()];
    l.nodes.forEach(n => {
      n.journalClusterIds = l.clusterIds;
    });
    return l;
  });
}

function createNodesByJournalId(nodes) {
  const map = nodes.reduce((nodesByJournalId, nodesByYear) => {
    nodesByYear.forEach(node => {
      if (!nodesByJournalId.has(node.journalId))
        nodesByJournalId.set(node.journalId, {
          journalId: node.journalId,
          clusterIds: new Set(),
          label: node.label,
          nodes: []
        });
      nodesByJournalId.get(node.journalId).clusterIds.add(node.clusterId);
      nodesByJournalId.get(node.journalId).nodes.push(node);
    });
    return nodesByJournalId;
  }, new Map());
  return [...map.values()];
}

function createLinks(nodes) {
  return nodes.sort((a, b) => +a.year - b.year).reduce(
    (acc, node) => {
      if (acc.previousNode !== undefined) {
        if (+node.year - acc.previousNode.year < 3) {
          acc.links.push({
            d: computeLinkShape(acc.previousNode, node),
            gradient: computeGradient(acc.previousNode, node)
          });
        }
      }
      acc.previousNode = node;
      return acc;
    },
    { links: [], previousNode: undefined }
  ).links;
}

function computeLinkShape(n1, n2) {
  function moveTo(x, y) {
    return "M " + x + " " + y;
  }
  function curveTo(x1, y1, x, y) {
    return "Q " + x1 + " " + y1 + " " + x + " " + y;
  }
  function lineTo(x, y) {
    return "L " + x + " " + y;
  }
  function endFill(x, y) {
    return "Z";
  }
  const dy = margin * (n2.y1 - n2.y0); // margin is a global variable
  const x1 = n1.x1,
    y1 = n1.y0,
    x2 = n2.x0,
    y2 = n2.y0,
    x3 = n2.x0,
    y3 = n2.y1 + dy,
    x4 = n1.x1,
    y4 = n1.y1 + dy;
  const diffX = x2 - x1;
  return [
    moveTo(x1, y1),
    curveTo(x1 + diffX * 0.33, y1, x1 + diffX * 0.5, (y1 + y2) / 2),
    curveTo(x2 - diffX * 0.33, y2, x2, y2),
    lineTo(x3, y3),
    curveTo(x3 - diffX * 0.33, y3, x1 + diffX * 0.5, (y3 + y4) / 2),
    curveTo(x4 + diffX * 0.33, y4, x4, y4),
    endFill()
  ].join(" ");
}

function computeGradient(n1, n2) {
  return {
    gradientId: ["gradient", n1.journalId, n1.year, n2.journalId, n2.year].join(
      "-"
    ),
    alpha: 0.5,
    x1: n1.x1,
    x2: n2.x0,
    normalColor1: n1.normalColor,
    normalColor2: n2.normalColor,
    fadedColor1: n1.fadedColor,
    fadedColor2: n2.fadedColor,
    opacity1: 0.8,
    opacity2: 0.5
  };
}

function createYearTitles(nodes, titleHeight) {
  return nodes.map(e => {
    return {
      text: e[0].year,
      x0: e[0].x0,
      y0: e[0].y0 - titleHeight
    };
  });
}

function createNodes(trees, years, height, width, titleHeight) {
  const dx = width / (2 * years.length - 1);
  return trees.map(cell => {
    const x0 = Math.round(years.indexOf(cell.year) * dx * 2);
    const data = cell.tree.reduce(
      (a, c) => {
        if ("weight" in c) {
          const journal = addPositionsAndColor(
            c,
            x0,
            dx,
            a.currentY,
            cell.year,
            fixCategory(cell.year)
          );
          a.currentY = journal.y1;
          a.journals.push(journal);
        } else a.currentY++;
        return a;
      },
      { currentY: 0, journals: [] }
    );
    const shiftY = (height - titleHeight - data.currentY) * 0.5 + titleHeight;
    data.journals.forEach(e => {
      e.y0 = Math.floor(e.y0 + shiftY);
      e.y1 = Math.floor(e.y1 + shiftY);
    });
    return data.journals;
  });
}

function addPositionsAndColor(cell, x0, dx, y0, year, fixCategory) {
  const color = getColorByIndexAndWeight({
    index: +fixCategory(cell.path[0]),
    weight: cell.weight,
    MIN_SAT: 0.5,
    MAX_SAT: 0.95,
    MIN_BRIGHTNESS: 0.8,
    MAX_BRIGHTNESS: 0.3
  });
  return {
    label: cell.label,
    longLabel: cell.longLabel,
    numId: cell.id,
    journalId: cell.label.replace(/ /g, "_"),
    clusterId: cell.parentPath + "-" + year,
    year: year,
    eigenfactor: cell.eigenfactor,
    weight: cell.weight,
    x0: x0,
    x1: x0 + dx,
    y0: y0,
    y1: Math.round(y0 + cell.weight * 40),
    normalColor: color,
    fadedColor: fadeColor(color)
  };
}

function fixCategory(year) {
  return function(category) {
    if (+year >= 1999 && year !== "2000")
      if (category === "3") return "4";
      else if (category === "4") return "3";
    return category;
  };
}

function fadeColor(color) {
  const hsvColor = d3.hsv(color);
  return d3.hsv(hsvColor.h, 0.02, 0.85);
}
