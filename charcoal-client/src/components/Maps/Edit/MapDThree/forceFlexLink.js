import {map} from "d3-collection"

//
// Crib the algorithm from the d3-force link force implementation, and tweak it to allow
// a safe range between minimum and maximum distance, where no force is applied.
//

//
// TODO: Convert to Typescript
//

const constant = (x) => {
    return function() {
      return x
    }
}

const jiggle = () => {
    return (Math.random() - 0.5) * 1e-6
}

function index(d) {
  return d.index;
}

function find(nodeById, nodeId) {
  var node = nodeById.get(nodeId);
  if (!node) throw new Error("missing: " + nodeId);
  return node;
}

export const forceFlexLink = function(links) {
  var id = index,
      strength = defaultStrength,
      strengths,
      minDistance = constant(70),
      minDistances,
      maxDistance = constant(120),
      maxDistances,
      nodes,
      count,
      bias,
      iterations = 1;

  if (links == null) links = [];

  function defaultStrength(link) {
    return 1 / Math.min(count[link.source.index], count[link.target.index]);
  }

  function force(alpha) {
    links.forEach((link, index) => {
        const source = link.source
        const target = link.target
        let x = target.x + target.vx - source.x - source.vx || jiggle();
        let y = target.y + target.vy - source.y - source.vy || jiggle();
        let l = Math.sqrt(x * x + y * y);
        if (l < minDistances[index]) {
            l = (l - minDistances[index]) / l * alpha * strengths[index];
        }
        else {
            if (l > maxDistances[index]) {
                l = ((l - maxDistances[index]) / (l - (maxDistances[index] - minDistances[index]))) * alpha * strengths[index];
            }
            else {
                l = 0
            }
        }
        x *= l
        y *= l
        let b = bias[index]
        target.vx -= x * b
        target.vy -= y * b
        //
        // TODO:  Make links unidirectional, only moving either the source or the target, so that a layer can be influenced
        // by an earlier layer, without influencing it in return.
        //
        b = 1 - b
        source.vx += x * b
        source.vy += y * b
    })
  }

  function initialize() {
    if (!nodes) return;

    var i,
        n = nodes.length,
        m = links.length,
        nodeById = map(nodes, id),
        link;

    for (i = 0, count = new Array(n); i < m; ++i) {
      link = links[i]
      link.index = i
      if (typeof link.source !== "object") link.source = find(nodeById, link.source);
      if (typeof link.target !== "object") link.target = find(nodeById, link.target);
      count[link.source.index] = (count[link.source.index] || 0) + 1;
      count[link.target.index] = (count[link.target.index] || 0) + 1;
    }

    for (i = 0, bias = new Array(m); i < m; ++i) {
      link = links[i]
      bias[i] = count[link.source.index] / (count[link.source.index] + count[link.target.index])
    }

    strengths = new Array(m)
    initializeStrength()
    minDistances = new Array(m)
    initializeMinDistance()
    maxDistances = new Array(m)
    initializeMaxDistance()
  }

  function initializeStrength() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      strengths[i] = +strength(links[i], i, links);
    }
  }

  function initializeMinDistance() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      minDistances[i] = +minDistance(links[i], i, links);
    }
  }

  function initializeMaxDistance() {
    if (!nodes) return;

    for (var i = 0, n = links.length; i < n; ++i) {
      maxDistances[i] = +maxDistance(links[i], i, links);
    }
  }

  force.initialize = function(_) {
    nodes = _;
    initialize();
  };

  force.links = function(_) {
    return arguments.length ? (links = _, initialize(), force) : links;
  };

  force.id = function(_) {
    return arguments.length ? (id = _, force) : id;
  };

  force.iterations = function(_) {
    return arguments.length ? (iterations = +_, force) : iterations;
  };

  force.strength = function(_) {
    return arguments.length ? (strength = typeof _ === "function" ? _ : constant(+_), initializeStrength(), force) : strength;
  };

  force.minDistance = function(_) {
    return arguments.length ? (minDistance = typeof _ === "function" ? _ : constant(+_), initializeMinDistance(), force) : minDistance;
  };

  force.maxDistance = function(_) {
    return arguments.length ? (maxDistance = typeof _ === "function" ? _ : constant(+_), initializeMaxDistance(), force) : maxDistance;
  };

  return force;
}

export default forceFlexLink
