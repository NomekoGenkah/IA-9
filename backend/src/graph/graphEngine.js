/**
 * Lazy graph engine — nodes are only expanded on demand.
 * Maintains an in-memory cache of explored states.
 * Exported as a singleton so all routes share the same graph state.
 */

const { validateState, generateNeighbors } = require('./permutation');

class GraphEngine {
  constructor() {
    // Map<stateId, { state, neighbors: string[] | null, exploredAt: number | null }>
    this.nodes = new Map();
  }

  _getOrCreate(id) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, { state: id, neighbors: null, exploredAt: null });
    }
    return this.nodes.get(id);
  }

  // Expand a node: compute its neighbors, cache them, register neighbor stubs.
  expandNode(id) {
    if (!validateState(id)) return null;

    const node = this._getOrCreate(id);
    if (node.neighbors !== null) return node; // already cached

    const neighborIds = generateNeighbors(id);
    node.neighbors = neighborIds;
    node.exploredAt = Date.now();

    for (const nId of neighborIds) {
      this._getOrCreate(nId); // register as known but unexplored
    }

    return node;
  }

  getNodeInfo(id) {
    if (!validateState(id)) return null;
    return this.nodes.get(id) || { state: id, neighbors: null, exploredAt: null };
  }

  getStats() {
    let explored = 0;
    for (const node of this.nodes.values()) {
      if (node.neighbors !== null) explored++;
    }
    return { totalKnown: this.nodes.size, explored };
  }
}

module.exports = new GraphEngine();
