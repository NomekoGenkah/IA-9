const DARK = {
  nodeBg:         '#161b22',
  nodeBorder:     '#30363d',
  nodeText:       '#8b949e',
  rootBg:         '#0d3b66',
  rootBorder:     '#388bfd',
  rootText:       '#cae8ff',
  exploredBg:     '#1c2d40',
  exploredBorder: '#388bfd',
  exploredText:   '#79c0ff',
  unexploredBg:   '#161b22',
  unexploredBorder:'#30363d',
  unexploredText: '#6e7681',
  selectedBorder: '#f78166',
  selectedText:   '#ffa198',
  edgeLine:       '#21262d',
  edgeFresh:      '#388bfd',
};

const LIGHT = {
  nodeBg:         '#ffffff',
  nodeBorder:     '#afb8c1',
  nodeText:       '#57606a',
  rootBg:         '#ddf4ff',
  rootBorder:     '#0969da',
  rootText:       '#0550ae',
  exploredBg:     '#f0f6ff',
  exploredBorder: '#0969da',
  exploredText:   '#0969da',
  unexploredBg:   '#f6f8fa',
  unexploredBorder:'#afb8c1',
  unexploredText: '#6e7781',
  selectedBorder: '#cf222e',
  selectedText:   '#cf222e',
  edgeLine:       '#d0d7de',
  edgeFresh:      '#0969da',
};

// settings: { nodeSize, edgeOpacity }
// accent: hex color string for borders/highlights
export function getCytoscapeStyle(isDark, settings = {}, accent = null) {
  const t = isDark ? DARK : LIGHT;
  const ac = accent ?? t.rootBorder;
  const nodeSize = settings.nodeSize ?? 68;
  const nodeHeight = Math.round(nodeSize * 0.91);
  const fontSize = Math.max(7, Math.round(nodeSize * 10 / 68));
  const edgeOpacity = settings.edgeOpacity ?? 0.7;

  return [
    {
      selector: 'node',
      style: {
        'background-color': t.nodeBg,
        'border-color': t.nodeBorder,
        'border-width': 1,
        'label': 'data(label)',
        'color': t.nodeText,
        'font-size': `${fontSize}px`,
        'font-family': '"Courier New", monospace',
        'text-valign': 'center',
        'text-halign': 'center',
        'text-wrap': 'wrap',
        'width': `${nodeSize}px`,
        'height': `${nodeHeight}px`,
        'shape': 'roundrectangle',
        'transition-property': 'background-color, border-color, border-width, color',
        'transition-duration': '200ms',
      },
    },
    {
      selector: 'node.root',
      style: {
        'background-color': t.rootBg,
        'border-color': ac,
        'border-width': 2,
        'color': t.rootText,
      },
    },
    {
      selector: 'node.explored',
      style: {
        'background-color': t.exploredBg,
        'border-color': ac,
        'border-width': 1,
        'color': t.exploredText,
      },
    },
    {
      selector: 'node.unexplored',
      style: {
        'background-color': t.unexploredBg,
        'border-color': t.unexploredBorder,
        'border-style': 'dashed',
        'color': t.unexploredText,
      },
    },
    {
      selector: 'node:selected',
      style: {
        'border-color': t.selectedBorder,
        'border-width': 2,
        'color': t.selectedText,
      },
    },
    {
      selector: 'edge',
      style: {
        'line-color': t.edgeLine,
        'width': 1,
        'curve-style': 'bezier',
        'opacity': edgeOpacity,
        'transition-property': 'line-color, opacity',
        'transition-duration': '400ms',
      },
    },
    {
      selector: 'edge.fresh',
      style: { 'line-color': ac, 'opacity': 1 },
    },
    // ── Solve path ──────────────────────────────────────────────
    {
      selector: 'node.path-node',
      style: {
        'background-color': isDark ? '#2d2a00' : '#fffbe5',
        'border-color': '#e3b341',
        'border-width': 2,
        'color': '#e3b341',
      },
    },
    {
      selector: 'node.path-start',
      style: {
        'background-color': isDark ? '#3d1a00' : '#fff0e0',
        'border-color': '#f0883e',
        'border-width': 3,
        'color': '#f0883e',
      },
    },
    {
      selector: 'node.path-end',
      style: {
        'background-color': isDark ? '#0d2e1e' : '#e6ffec',
        'border-color': '#3fb950',
        'border-width': 3,
        'color': '#3fb950',
      },
    },
    {
      selector: 'edge.path-edge',
      style: {
        'line-color': '#e3b341',
        'width': 2,
        'opacity': 1,
        'z-index': 10,
      },
    },
  ];
}

// cose is bundled with cytoscape — no external layout package needed
export const layoutOptions = {
  name: 'cose',
  animate: true,
  animationDuration: 350,
  randomize: false,
  fit: false,
  padding: 40,
  nodeRepulsion: 12000,
  idealEdgeLength: 90,
  edgeElasticity: 100,
  gravity: 0.25,
  numIter: 1000,
  initialTemp: 200,
  coolingFactor: 0.95,
  minTemp: 1,
};
