import path from 'path';
import { Graph } from './core/graph.js';
import { loadData } from './core/dataLoader.js';
import { QueryEngine } from './core/queryEngine.js';

async function main() {
  const dataDir = path.resolve('sap-o2c-data');
  
  console.log('Initializing Graph...');
  const graph = new Graph();
  
  console.log(`Loading data from ${dataDir}...`);
  await loadData(graph, dataDir);
  
  console.log(`Data loaded. Total Nodes: ${graph.nodes.size}, Total Edges defined: ${graph.edges.size}`);
  
  const queryEngine = new QueryEngine(graph);

  console.log('\n--- traceFullFlow (90678703) ---');
  const flow1 = queryEngine.traceFullFlow('90678703');
  console.log(JSON.stringify(flow1, null, 2));

  console.log('\n--- traceFullFlow (91150083) ---');
  const flow2 = queryEngine.traceFullFlow('91150083');
  console.log(JSON.stringify(flow2, null, 2));
}

main().catch(console.error);
