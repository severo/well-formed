const config = { titleHeight: 45, titlePosition: [18, 28] },
  data = {},
  results = {};

/* mutable */
var width,
  height,
  clicked = -1;

/*
 * Colors & CSS
 */
const colorCategory = [
  { name: "purple", hex: "#db2872" },
  { name: "green", hex: "#b5c92d" },
  { name: "blue", hex: "#3e9ad6" },
  { name: "orange", hex: "#e45c1e" }
].map(e => e.hex);

function svgcss() {
  return `
    svg {background: #f0f0f0; }

svg text, button {
    -webkit-user-select: none;
       -moz-user-select: none;
        -ms-user-select: none;
            user-select: none;
}
svg text::selection {
    background: none;
}

    text { font-family: flama, sans-serif; font-weight: bold; }

    #maintitle rect, .maintitle rect { fill: none; }
    #maintitle text, .maintitle text { fill: #555; font-size: 1em; font-family: flama, sans-serif; font-weight: bold;  }

    g.tooltip {}
    g.tooltip rect.background {fill: #000000; stroke: #333333; fill-opacity: 0.8}
    g.tooltip text.text {font-family: flama, sans-serif; font-weight: bold; font-size: 12px;}
    g.tooltip text.text tspan.title {fill: #ffffff;}
    g.tooltip text.text tspan.detail {fill: #aaaaaa;}

`;
}
function svgshadowfilter() {
  return `
        <filter id="drop-shadow">
          <feDropShadow dx="1" dy="1" stdDeviation="1" flood-color="#000000" flood-opacity="0.5">
          </feDropShadow>
        </filter>
`;
}

/*
 * Load and parse data
 */

const currentYear = `2005`;

async function loadMapRawData() {
  return await Promise.all([
    d3.text(`data/science${currentYear}links.txt`),
    d3.text(`data/science${currentYear}nodes.txt`),
    d3.text(`data/science${currentYear}tree.txt`),
    d3.json("data/mapgml.json")
  ]);
}
async function loadRawData(year = currentYear) {
  return await Promise.all([
    d3.text(`data/science${year}links_mo.txt`),
    d3.text(`data/science${year}nodes_mo.txt`),
    d3.text(`data/science${year}tree_mo.txt`)
  ]);
}
async function loadRawSankeyData(year = currentYear) {
  return await Promise.all([
    d3.text(`data/science${year}nodes_mo.txt`),
    d3.text(`data/science${year}tree_mo.txt`)
  ]);
}

(async function() {
  if (vis === "sankey") {
    data.years = [8, 6, 4, 2, 0].map(e => +currentYear - e + "");
    data.trees = await Promise.all(
      data.years.map(async y => {
        let _nodes, _tree, _idsByName;
        [_nodes, _tree] = await loadRawSankeyData(y);
        _idsByName = IDsByName(ids(_nodes));
        return {
          year: y,
          tree: tree(_tree, _idsByName)
        };
      })
    );
  } else {
    let _links, _nodes, _tree, _nodesmap;
    if (vis === "map") {
      [_links, _nodes, _tree, _nodesmap] = await loadMapRawData();
      data.nodesmap = _nodesmap;
    } else {
      [_links, _nodes, _tree] = await loadRawData(currentYear);
    }

    data.flowEdges = flowEdges(_links);
    data.ids = ids(_nodes);
    data.IDsByName = IDsByName(data.ids);
    data.tree = tree(_tree, data.IDsByName);
  }
  d3.select(window).on("resize", redraw);
  redraw();
})();

var wait = 20;
function redraw() {
  width = window.innerWidth;
  height = Math.min(window.innerHeight, width);

  if (typeof buildchart !== "function") {
    console.log("Waiting for buildchart to load…", wait);
    if (wait-- > 0) setTimeout(redraw, 1000);
  } else {
    buildchart();
  }
}

/*
 * Parsing
 */
function flowEdges(links) {
  const l = d3
    .dsvFormat("\t")
    .parseRows(links)
    .map(d => ({
      source: d[0],
      target: d[1],
      weight: +d[2]
    }));
  const maxEdgeWeight = l.reduce(
    (a, c) => ("weight" in c && c.weight > a ? c.weight : a),
    0
  );
  return l.map(e => {
    if ("weight" in e) {
      e.normalizedWeight =
        Math.log(1 + (e.weight / maxEdgeWeight) * 10) / Math.log(11);
    }
    return e;
  });
}

function ids(_nodes) {
  return d3
    .dsvFormat("\t")
    .parseRows(_nodes)
    .map(e => {
      return {
        id: e[0],
        name: e[1],
        longName: e[2]
      };
    });
}

function IDsByName(ids) {
  return ids.reduce((a, c) => {
    a.set(c.name, c.id);
    return a;
  }, new Map());
}

function tree(_tree, _idsByName) {
  const root = [{ path: "_", label: "root", value: 1 }];
  const tree = d3
    .dsvFormat("\t")
    .parseRows(_tree)
    .map(e => {
      const cell = {
        path: e[0],
        label: e[2]
      };
      if (e.length == 4) {
        cell.longLabel = e[3];
        cell.eigenfactor = parseFloat(e[1]);
      } else {
        cell.parentEigenfactor = parseFloat(e[1]);
      }
      cell.id = _idsByName.get(cell.label)
        ? _idsByName.get(cell.label)
        : "p_" + cell.path.split(":").join(",");
      cell.parentPath = cell.path
        .split(":")
        .slice(0, -1)
        .join(":");
      if (cell.parentPath === "") cell.parentPath = "_";
      return cell;
    })
    .concat(root);
  const maxEigenfactor = tree.reduce(
    (a, c) => ("eigenfactor" in c && c.eigenfactor > a ? c.eigenfactor : a),
    0
  );
  return tree.map(e => {
    if ("eigenfactor" in e) {
      e.weight = e.eigenfactor / maxEigenfactor;
      e.logWeight = Math.log(1 + e.weight * 10) / Math.log(11);
    }
    return e;
  });
}

/*
 * Utilities
 */
// We cannot use format = d3.format(".6f"), because the original implementation is slighlty different
function cutAfter(n, d) {
  let s = n.toString();
  let dotPos = s.indexOf(".");
  if (dotPos === -1) {
    s += ".";
    dotPos = s.length - 1;
  }
  return s.length - dotPos < d
    ? s + "0".repeat(d - s.length + dotPos + 1)
    : s.substring(0, dotPos + d + 1);
}

// https://github.com/observablehq/notebook-stdlib/blob/master/src/dom/uid.js
DOM = (function() {
  var count = 0;
  function uid(name) {
    return new Id("O-" + (name == null ? "" : name + "-") + ++count);
  }
  function Id(id) {
    this.id = id;
    this.href = window.location.href + "#" + id;
  }
  Id.prototype.toString = function() {
    return "url(" + this.href + ")";
  };
  return { uid };
})();

/* Inspired by https://github.com/d3/d3-interpolate/blob/master/src/rgb.js */
function interpolateRgbFloor(a, b, t) {
  function linear(a, d) {
    return function(t) {
      return a + t * d;
    };
  }
  function constant(x) {
    return function() {
      return x;
    };
  }
  function nogamma(a, b) {
    var d = b - a;
    return d ? linear(a, d) : constant(isNaN(a) ? b : a);
  }
  function rgb(start, end) {
    var r = nogamma((start = d3.rgb(start)).r, (end = d3.rgb(end)).r),
      g = nogamma(start.g, end.g),
      b = nogamma(start.b, end.b),
      opacity = nogamma(start.opacity, end.opacity);
    return function(t) {
      start.r = Math.floor(r(t));
      start.g = Math.floor(g(t));
      start.b = Math.floor(b(t));
      start.opacity = opacity(t);
      return start + "";
    };
  }
  return rgb(a, b, t);
}

function getColorByIndexAndWeight({
  index,
  weight = 0,
  MIN_SAT = 0.3,
  MAX_SAT = 0.9,
  MIN_BRIGHTNESS = 0.85,
  MAX_BRIGHTNESS = 0.5
}) {
  const baseColor = colorCategory[index - 1];
  const hue = d3.hsl(baseColor).h;
  const w = Math.max(0, Math.min(1, weight));
  minColor = hue => d3.hsv(hue, MIN_SAT, MIN_BRIGHTNESS);
  maxColor = hue => d3.hsv(hue, MAX_SAT, MAX_BRIGHTNESS);
  /* We have to use a custom interpolation function to reproduce
   * the Flare RGB color interpolation, since they approximate the
   * RGB channels with the "floor" function, and d3 with the "round"
   * function. */
  const palette = interpolateRgbFloor(minColor(hue), maxColor(hue));
  return palette(w);
}

function tooltip(
  id,
  w,
  h,
  title,
  text1 = "",
  text2 = "",
  value1 = "",
  value2 = ""
) {
  const cursor = d3.mouse(d3.select("svg").node());
  d3.selectAll(".tooltip").remove();
  const tooltip = d3
    .select("g#tooltip")
    .append("g")
    .classed("tooltip", true)
    .attr("id", id);

  const rect = tooltip
    .append("rect")
    .classed("background", true)
    .attr("x", 0)
    .attr("y", 0)
    .style("filter", "url(#drop-shadow)");

  const text = tooltip
    .append("text")
    .classed("text", true)
    .attr("x", 0)
    .attr("y", 0);

  function appendTspan(t, c, x, dy, text) {
    if (text !== "")
      t.append("tspan")
        .classed(c, true)
        .attr("x", x)
        .attr("dy", dy)
        .text(text);
  }

  appendTspan(text, "title", 5, "1em", title);
  appendTspan(text, "detail", 5, "1.2em", text1);
  appendTspan(text, "detail", "4.5em", 0, value1);
  appendTspan(text, "detail", 5, "1em", text2);
  appendTspan(text, "detail", "4.5em", 0, value2);

  /* Position */
  const bbox = text.node().getBBox();
  rect
    .attr("width", bbox.width + 10)
    .attr("height", bbox.height + 11)
    .attr("y", -4);

  /* Manage the bottom and right edges */
  let x = cursor[0];
  let y = cursor[1] + 26;
  if (x + bbox.width + 8 + 2 > w) x = x - bbox.width - 10;
  if (y + bbox.height + 26 + 2 > h) y = y - bbox.height - 10 - 26;
  tooltip.attr("transform", `translate(${x},${y})`);
}
