export class Graph {
  constructor() {
    this.nodes = new Map(); // id -> { id, type, data }
    this.edges = new Map(); // sourceId -> array of { target, type, dir: 'out'/'in' }
  }

  addNode(id, type, data = {}, originalId = undefined) {
    if (!this.nodes.has(id)) {
      const node = { id, type, data };
      if (originalId !== undefined) {
        node.originalId = originalId;
      }
      this.nodes.set(id, node);
    } else {
      // Merge data if node already exists
      const existing = this.nodes.get(id);
      existing.data = { ...existing.data, ...data };
      if (originalId !== undefined) {
        existing.originalId = originalId;
      }
    }
  }

  addEdge(source, target, type) {
    if (!this.edges.has(source)) this.edges.set(source, []);
    if (!this.edges.has(target)) this.edges.set(target, []);

    // Check if edge already exists to prevent duplicates
    const sourceEdges = this.edges.get(source);
    const targetEdges = this.edges.get(target);

    if (!sourceEdges.find(e => e.target === target && e.type === type && e.dir === 'out')) {
      sourceEdges.push({ target, type, dir: 'out' });
    }
    if (!targetEdges.find(e => e.target === source && e.type === type && e.dir === 'in')) {
      targetEdges.push({ target: source, type, dir: 'in' });
    }
  }

  getNode(id) {
    return this.nodes.get(id);
  }

  getEdges(id) {
    return this.edges.get(id) || [];
  }

  getNodesByType(type) {
    return Array.from(this.nodes.values()).filter(n => n.type === type);
  }

  getOutgoing(id, type) {
    const edges = this.edges.get(id) || [];
    return edges.filter(e => e.type === type && e.dir === 'out');
  }

  getIncoming(id, type) {
    const edges = this.edges.get(id) || [];
    return edges.filter(e => e.type === type && e.dir === 'in');
  }
}
