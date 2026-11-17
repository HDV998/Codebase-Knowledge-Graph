import { neo4jService } from './neo4jClient';
import type { BaseNode, GraphEdge, KnowledgeGraphData } from '../../ingestion-engine/src/types';

function indexGraph(store: KnowledgeGraphData) {
  const nodes = new Map(store.nodes.map(node => [node.id, node]));
  const upstream = new Map<string, GraphEdge[]>();
  const downstream = new Map<string, GraphEdge[]>();
  const testsByTarget = new Map<string, GraphEdge[]>();
  const add = (index: Map<string, GraphEdge[]>, key: string, edge: GraphEdge) => {
    const edges = index.get(key);
    if (edges) edges.push(edge);
    else index.set(key, [edge]);
  };
  for (const edge of store.edges) {
    if (edge.type === 'CALLS' || edge.type === 'IMPORTS') {
      add(downstream, edge.source, edge);
      add(upstream, edge.target, edge);
    } else if (edge.type === 'HAS_METHOD') {
      add(upstream, edge.target, edge);
    }
    if (nodes.get(edge.source)?.type === 'Test') add(testsByTarget, edge.target, edge);
  }
  return { nodes, upstream, downstream, testsByTarget };
}

export interface ImpactedNodeResult {
  node: any;
  depth: number;
  relationship: string;
  riskContribution: number;
  directPath: string[];
}

export interface BlastRadiusReport {
  targetNode: any;
  riskScore: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  impactedNodes: ImpactedNodeResult[];
  affectedTests: any[];
  affectedFilesCount: number;
  affectedFunctionsCount: number;
  summary: string;
  highlightedNodeIds: string[];
  highlightedEdgeIds: string[];
}

export class BlastRadiusEngine {
  private indexes = new WeakMap<KnowledgeGraphData, ReturnType<typeof indexGraph>>();
  public calculateBlastRadius(
    nodeId: string, 
    repoId: string, 
    maxDepth = 3, 
    direction: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH' = 'UPSTREAM'
  ): BlastRadiusReport {
    const store = neo4jService.getStore(repoId);
    if (!store) {
      throw new Error(`Repository ${repoId} not found`);
    }

    if (!Number.isInteger(maxDepth) || maxDepth < 0 || maxDepth > 20) {
      throw new Error('Traversal depth must be an integer between 0 and 20.');
    }
    let index = this.indexes.get(store);
    if (!index) {
      index = indexGraph(store);
      this.indexes.set(store, index);
    }
    const targetNode = index.nodes.get(nodeId) ?? store.nodes.find(node => node.name === nodeId);
    if (!targetNode) {
      throw new Error(`Node with ID or name '${nodeId}' not found in codebase`);
    }

    const visitedNodeIds = new Set<string>([targetNode.id]);
    const highlightedEdges = new Set<string>();
    const impactedNodes: ImpactedNodeResult[] = [];
    const affectedTests = new Map<string, BaseNode>();
    const affectedFiles = new Set<string>(targetNode.filePath ? [targetNode.filePath] : []);

    // Queue for BFS traversal
    // [nodeId, currentDepth, pathSoFar]
    const queue: [string, number, string[]][] = [[targetNode.id, 0, [targetNode.name]]];

    for (let cursor = 0; cursor < queue.length; cursor++) {
      const [currId, depth, path] = queue[cursor];
      if (depth >= maxDepth) continue;

      // 1. Upstream callers (Edges where target is currId and type is CALLS, IMPORTS, or DEFINES)
      if (direction === 'UPSTREAM' || direction === 'BOTH') {
        const upstreamEdges = index.upstream.get(currId) ?? [];
        for (const edge of upstreamEdges) {
          highlightedEdges.add(edge.id);
          const callerNode = index.nodes.get(edge.source);
          if (callerNode && !visitedNodeIds.has(callerNode.id)) {
            visitedNodeIds.add(callerNode.id);
            if (callerNode.filePath) affectedFiles.add(callerNode.filePath);

            const depthFactor = 1 / (depth + 1);
            const riskContrib = Number(((((callerNode as any).blastRadiusWeight || 1)) * depthFactor).toFixed(2));

            impactedNodes.push({
              node: callerNode,
              depth: depth + 1,
              relationship: `called_by (${edge.type})`,
              riskContribution: riskContrib,
              directPath: [...path, callerNode.name]
            });

            queue.push([callerNode.id, depth + 1, [...path, callerNode.name]]);
          }
        }
      }

      // 2. Downstream callees (Edges where source is currId and type is CALLS)
      if (direction === 'DOWNSTREAM' || direction === 'BOTH') {
        const downstreamEdges = index.downstream.get(currId) ?? [];
        for (const edge of downstreamEdges) {
          highlightedEdges.add(edge.id);
          const calleeNode = index.nodes.get(edge.target);
          if (calleeNode && !visitedNodeIds.has(calleeNode.id)) {
            visitedNodeIds.add(calleeNode.id);
            if (calleeNode.filePath) affectedFiles.add(calleeNode.filePath);

            impactedNodes.push({
              node: calleeNode,
              depth: depth + 1,
              relationship: `calls (${edge.type})`,
              riskContribution: 0.5 / (depth + 1),
              directPath: [...path, calleeNode.name]
            });

            queue.push([calleeNode.id, depth + 1, [...path, calleeNode.name]]);
          }
        }
      }
    }

    // 3. Find all connected Tests
    for (const id of visitedNodeIds) {
      for (const edge of index.testsByTarget.get(id) ?? []) {
        const test = index.nodes.get(edge.source);
        if (test) affectedTests.set(test.id, test);
        highlightedEdges.add(edge.id);
      }
    }

    // 4. Calculate Risk Score
    const totalImpactScore = impactedNodes.reduce((acc, curr) => acc + curr.riskContribution, 0) + ((targetNode as any).blastRadiusWeight || 1);
    const affectedFuncs = impactedNodes.filter(n => n.node.type === 'Function').length;

    let riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' = 'LOW';
    if (totalImpactScore > 15 || affectedFiles.size > 5) {
      riskLevel = 'CRITICAL';
    } else if (totalImpactScore > 8 || affectedFiles.size > 2) {
      riskLevel = 'HIGH';
    } else if (totalImpactScore > 3 || affectedFiles.size > 1) {
      riskLevel = 'MEDIUM';
    }

    const summary = `Modifying '${targetNode.name}' directly impacts ${affectedFuncs} functions across ${affectedFiles.size} files, with ${affectedTests.size} test suites directly covering this call graph. Risk level assessed as ${riskLevel} (${totalImpactScore.toFixed(1)} pts).`;

    return {
      targetNode,
      riskScore: Number(totalImpactScore.toFixed(2)),
      riskLevel,
      impactedNodes,
      affectedTests: [...affectedTests.values()],
      affectedFilesCount: affectedFiles.size,
      affectedFunctionsCount: affectedFuncs,
      summary,
      highlightedNodeIds: Array.from(visitedNodeIds),
      highlightedEdgeIds: Array.from(highlightedEdges)
    };
  }
}

export const blastRadiusEngine = new BlastRadiusEngine();
