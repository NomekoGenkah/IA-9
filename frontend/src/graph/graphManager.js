import { layoutOptions } from './cytoscapeConfig';

function matrixLabel(id) {
  return `${id[0]} ${id[1]} ${id[2]}\n${id[3]} ${id[4]} ${id[5]}\n${id[6]} ${id[7]} ${id[8]}`;
}

function circlePositions(center, radius, count) {
  return Array.from({ length: count }, (_, i) => {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    return { x: center.x + radius * Math.cos(angle), y: center.y + radius * Math.sin(angle) };
  });
}

// All positions kept in a local Map → iterate without touching cy API,
// write back once in a single cy.batch() at the end.
function resolveOverlaps(cy, newNodeIds, minDist) {
  const allNodes = cy.nodes();

  // Snapshot all positions into a local Map
  const pos = new Map();
  allNodes.forEach((n) => pos.set(n.id(), { ...n.position() }));

  const newSet = new Set(newNodeIds);

  for (let iter = 0; iter < 40; iter++) {
    let moved = false;

    for (const id of newNodeIds) {
      const p = pos.get(id);

      pos.forEach((op, otherId) => {
        if (otherId === id) return;
        const dx = p.x - op.x;
        const dy = p.y - op.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < minDist && dist > 0.01) {
          const push = (minDist - dist) * 0.55;
          p.x += (dx / dist) * push;
          p.y += (dy / dist) * push;
          moved = true;
        }
      });
    }

    if (!moved) break;
  }

  // Commit only new nodes (existing nodes are anchors)
  cy.batch(() => {
    for (const id of newNodeIds) {
      cy.getElementById(id).position(pos.get(id));
    }
  });
}

export class GraphManager {
  constructor(cy) {
    this.cy = cy;
    this.explored = new Set();
  }

  hasNode(id) { return this.cy.getElementById(id).length > 0; }
  isExplored(id) { return this.explored.has(id); }

  addRootNode(id) {
    if (this.hasNode(id)) return;
    const ext = this.cy.extent();
    const pos = { x: (ext.x1 + ext.x2) / 2, y: (ext.y1 + ext.y2) / 2 };
    this.cy.add({ group: 'nodes', data: { id, label: matrixLabel(id) }, position: pos, classes: 'root' });
    this.cy.fit(undefined, 80);
    this.cy.zoom(Math.min(this.cy.zoom(), 1.8));
  }

  _addNodeAt(id, position, cls = 'unexplored') {
    if (this.hasNode(id)) return false;
    this.cy.add({ group: 'nodes', data: { id, label: matrixLabel(id) }, position: { ...position }, classes: cls });
    return true;
  }

  // Random node — placed near viewport center, then deoverlapped
  addNode(id) {
    if (this.hasNode(id)) return;
    const pan = this.cy.pan(), zoom = this.cy.zoom();
    const cx = (this.cy.width()  / 2 - pan.x) / zoom;
    const cy_ = (this.cy.height() / 2 - pan.y) / zoom;
    this._addNodeAt(id, { x: cx + (Math.random() - 0.5) * 60, y: cy_ + (Math.random() - 0.5) * 60 });

    // Push against every existing node
    const minDist = 68 + 80; // use safe default; caller can re-resolve with real settings if needed
    resolveOverlaps(this.cy, [id], minDist);
  }

  // Random node with correct settings applied
  addNodeWithSettings(id, settings) {
    if (this.hasNode(id)) return;
    const pan = this.cy.pan(), zoom = this.cy.zoom();
    const cx = (this.cy.width()  / 2 - pan.x) / zoom;
    const cy_ = (this.cy.height() / 2 - pan.y) / zoom;
    this._addNodeAt(id, { x: cx + (Math.random() - 0.5) * 60, y: cy_ + (Math.random() - 0.5) * 60 });
    const minDist = (settings.nodeSize ?? 68) + (settings.nodeSpacing ?? 80);
    resolveOverlaps(this.cy, [id], minDist);
  }

  addEdge(sourceId, targetId) {
    const fwd = `${sourceId}>${targetId}`;
    const rev = `${targetId}>${sourceId}`;
    if (this.cy.getElementById(fwd).length || this.cy.getElementById(rev).length) return null;
    this.cy.add({ group: 'edges', data: { id: fwd, source: sourceId, target: targetId }, classes: 'fresh' });
    setTimeout(() => this.cy.getElementById(fwd).removeClass('fresh'), 800);
    return fwd;
  }

  expandFromNeighbors(sourceId, neighbors, settings = {}) {
    const nodeSize    = settings.nodeSize    ?? 68;
    const nodeSpacing = settings.nodeSpacing ?? 80;
    const panDuration = settings.panDuration ?? 450;
    const minDist     = nodeSize + nodeSpacing;

    this.explored.add(sourceId);
    const sourceNode = this.cy.getElementById(sourceId);
    sourceNode.removeClass('root unexplored').addClass('explored');

    const newNeighbors = neighbors.filter((n) => !this.hasNode(n.id));

    if (newNeighbors.length > 0) {
      const radius = Math.max(minDist * 1.1, (minDist * newNeighbors.length) / (2 * Math.PI));
      const positions = circlePositions(sourceNode.position(), radius, newNeighbors.length);

      // Add all new nodes in one batch
      this.cy.batch(() => {
        newNeighbors.forEach((n, i) => this._addNodeAt(n.id, positions[i]));
      });

      resolveOverlaps(this.cy, newNeighbors.map((n) => n.id), minDist);
    }

    // Add all edges in one batch
    this.cy.batch(() => {
      for (const n of neighbors) this.addEdge(sourceId, n.id);
    });

    this.cy.animate({ center: { eles: sourceNode }, duration: panDuration, easing: 'ease-in-out-quad' });
    return newNeighbors.length;
  }

  // ── Drag repulsion ────────────────────────────────────────────────────────
  setupDragRepulsion(getSettings) {
    let rafId    = null;
    let draggedId = null;

    this.cy.on('drag', 'node', (evt) => {
      draggedId = evt.target.id();
      if (rafId !== null) return;

      rafId = requestAnimationFrame(() => {
        rafId = null;
        const dragged = this.cy.getElementById(draggedId);
        if (!dragged.length) return;

        const { nodeSize = 68, nodeSpacing = 80 } = getSettings();
        const minDist = nodeSize + nodeSpacing;
        const influenceR = minDist * 2.5;
        const dp = dragged.position();

        // Collect affected nodes and snapshot their positions
        const affected = [];
        const pos = new Map();
        this.cy.nodes().forEach((n) => {
          if (n.id() === draggedId) return;
          const p = n.position();
          if ((p.x - dp.x) ** 2 + (p.y - dp.y) ** 2 < influenceR ** 2) {
            affected.push(n.id());
            pos.set(n.id(), { ...p });
          }
        });

        if (affected.length === 0) return;

        for (let iter = 0; iter < 8; iter++) {
          let moved = false;

          for (const id of affected) {
            const p = pos.get(id);

            // Repulsion from dragged node
            let dx = p.x - dp.x, dy = p.y - dp.y;
            let dist = Math.sqrt(dx * dx + dy * dy);
            if (dist < minDist && dist > 0.01) {
              const f = (minDist - dist) * 0.7;
              p.x += (dx / dist) * f; p.y += (dy / dist) * f;
              moved = true;
            }

            // Repulsion from peers
            for (const otherId of affected) {
              if (otherId === id) continue;
              const op = pos.get(otherId);
              dx = p.x - op.x; dy = p.y - op.y;
              dist = Math.sqrt(dx * dx + dy * dy);
              if (dist < minDist && dist > 0.01) {
                const f = (minDist - dist) * 0.35;
                p.x += (dx / dist) * f; p.y += (dy / dist) * f;
                moved = true;
              }
            }
          }

          if (!moved) break;
        }

        // Write all positions at once
        this.cy.batch(() => {
          for (const id of affected) {
            this.cy.getElementById(id).position(pos.get(id));
          }
        });
      });
    });

    this.cy.on('dragfree', 'node', () => { draggedId = null; });
  }

  // ── Order / layout ────────────────────────────────────────────────────────
  orderGraph(settings = {}) {
    const nodeSize    = settings.nodeSize    ?? 68;
    const nodeSpacing = settings.nodeSpacing ?? 80;
    const minDist     = nodeSize + nodeSpacing;

    const opts = {
      ...layoutOptions,
      nodeRepulsion: minDist ** 2 * 3,
      idealEdgeLength: minDist * 1.5,
      fit: false,
      animate: true,
      animationDuration: 600,
    };

    const layout = this.cy.layout(opts);
    layout.run();

    // Final overlap cleanup after layout settles
    layout.on('layoutstop', () => {
      const allIds = this.cy.nodes().map((n) => n.id());
      resolveOverlaps(this.cy, allIds, minDist);
    });
  }

  // ── Solve path ────────────────────────────────────────────────────────────
  highlightSolvePath(pathStates, settings = {}) {
    this.clearSolvePath();

    const nodeSize    = settings.nodeSize    ?? 68;
    const nodeSpacing = settings.nodeSpacing ?? 80;
    const minDist     = nodeSize + nodeSpacing;

    const newIds = [];

    // Add missing nodes in a diagonal chain from the start
    const startNode = this.cy.getElementById(pathStates[0]);
    let prevPos = startNode.length ? { ...startNode.position() } : { x: 0, y: 0 };
    const step = minDist * 1.2;

    for (let i = 1; i < pathStates.length; i++) {
      const id = pathStates[i];
      if (!this.hasNode(id)) {
        const pos = { x: prevPos.x + step, y: prevPos.y + step * 0.5 };
        this._addNodeAt(id, pos);
        newIds.push(id);
        prevPos = pos;
      } else {
        prevPos = { ...this.cy.getElementById(id).position() };
      }
    }

    if (newIds.length > 0) resolveOverlaps(this.cy, newIds, minDist);

    // Apply path classes and edges
    this.cy.batch(() => {
      for (let i = 0; i < pathStates.length; i++) {
        const node = this.cy.getElementById(pathStates[i]);
        if (i === 0)                        node.addClass('path-start');
        else if (i === pathStates.length - 1) node.addClass('path-end');
        else                                 node.addClass('path-node');

        if (i > 0) {
          const edgeId = this.addEdge(pathStates[i - 1], pathStates[i]);
          const fwd = `${pathStates[i - 1]}>${pathStates[i]}`;
          const rev = `${pathStates[i]}>${pathStates[i - 1]}`;
          const edge = this.cy.getElementById(fwd).length
            ? this.cy.getElementById(fwd)
            : this.cy.getElementById(rev);
          if (edge.length) edge.addClass('path-edge');
        }
      }
    });
  }

  clearSolvePath() {
    this.cy.nodes('.path-node, .path-start, .path-end').removeClass('path-node path-start path-end');
    this.cy.edges('.path-edge').removeClass('path-edge');
  }

  // ── Utilities ─────────────────────────────────────────────────────────────
  runLayout() { this.cy.layout(layoutOptions).run(); }

  centerOn(id) {
    const el = this.cy.getElementById(id);
    if (el.length) this.cy.animate({ center: { eles: el }, duration: 350, easing: 'ease-in-out-quad' });
  }

  stats() {
    return { nodes: this.cy.nodes().length, edges: this.cy.edges().length, explored: this.explored.size };
  }

  reset() {
    this.cy.elements().remove();
    this.explored.clear();
  }
}
