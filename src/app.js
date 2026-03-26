import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { DATA_DIR } from './config/index.js';
import { Graph } from './core/graph.js';
import { loadData } from './core/dataLoader.js';
import { QueryEngine } from './core/queryEngine.js';
import queryRoutes from './api/routes/queryRoutes.js';
import graphRoutes from './api/routes/graphRoutes.js';
import narrateRoutes from './api/routes/narrateRoutes.js';

const app = express();
app.use(cors());
app.use(express.json());

// Middleware to ensure graph initialization is complete before any route is handled.
// Crucial for serverless environments where cold starts are common.
app.use(async (req, res, next) => {
  try {
    await init();
    next();
  } catch (err) {
    console.error('Initialization error during request:', err);
    res.status(503).json({ error: 'Initialization Error', message: 'Engine failed to start' });
  }
});

// Mount routes
app.use(queryRoutes);
app.use(graphRoutes);
app.use(narrateRoutes);

let initPromise = null;

/**
 * Initialize graph data and attach shared instances to app.locals
 * so controllers can access them via req.app.locals.
 */
async function init() {
  if (initPromise) return initPromise;

  initPromise = (async () => {
    console.log('Loading graph data...');
    const graph = new Graph();
    await loadData(graph, DATA_DIR);
    const queryEngine = new QueryEngine(graph);
    
    console.log(`Graph ready. Nodes: ${graph.nodes.size}, Edge sets: ${graph.edges.size}`);
    
    // Expose to controllers via req.app.locals
    app.locals.graph = graph;
    app.locals.queryEngine = queryEngine;
    
    return { graph, queryEngine };
  })();

  return initPromise;
}

// Start initialization automatically for serverless/cold starts
init().catch(err => console.error('Early init failed:', err));

export { app, init };
export default app;
