import { neo4jService } from './neo4jClient';

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

    const targetNode = store.nodes.find(n => n.id === nodeId || n.name === nodeId);
    if (!targetNode) {
      throw new Error(`Node with ID or name '${nodeId}' not found in codebase`);
    }

    const visitedNodeIds = new Set<string>([targetNode.id]);
    const highlightedEdges = new Set<string>();
    const impactedNodes: ImpactedNodeResult[] = [];
    const affectedTests: any[] = [];
    const affectedFiles = new Set<string>([targetNode.filePath || '']);

    // Queue for BFS traversal
    // [nodeId, currentDepth, pathSoFar]
    const queue: [string, number, string[]][] = [[targetNode.id, 0, [targetNode.name]]];

    while (queue.length > 0) {
      const [currId, depth, path] = queue.shift()!;
      if (depth >= maxDepth) continue;

      // 1. Upstream callers (Edges where target is currId and type is CALLS, IMPORTS, or DEFINES)
      if (direction === 'UPSTREAM' || direction === 'BOTH') {
        const upstreamEdges = store.edges.filter(e => e.target === currId && (e.type === 'CALLS' || e.type === 'IMPORTS' || e.type === 'HAS_METHOD'));
        for (const edge of upstreamEdges) {
          highlightedEdges.add(edge.id);
          const callerNode = store.nodes.find(n => n.id === edge.source);
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
        const downstreamEdges = store.edges.filter(e => e.source === currId && (e.type === 'CALLS' || e.type === 'IMPORTS'));
        for (const edge of downstreamEdges) {
          highlightedEdges.add(edge.id);
          const calleeNode = store.nodes.find(n => n.id === edge.target);
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
    const allImpactedIds = Array.from(visitedNodeIds);
    for (const testNode of store.nodes.filter(n => n.type === 'Test')) {
      const testEdges = store.edges.filter(e => e.source === testNode.id && allImpactedIds.includes(e.target));
      if (testEdges.length > 0) {
        affectedTests.push(testNode);
        for (const te of testEdges) highlightedEdges.add(te.id);
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

    const summary = `Modifying '${targetNode.name}' directly impacts ${affectedFuncs} functions across ${affectedFiles.size} files, with ${affectedTests.length} test suites directly covering this call graph. Risk level assessed as ${riskLevel} (${totalImpactScore.toFixed(1)} pts).`;

    return {
      targetNode,
      riskScore: Number(totalImpactScore.toFixed(2)),
      riskLevel,
      impactedNodes,
      affectedTests,
      affectedFilesCount: affectedFiles.size,
      affectedFunctionsCount: affectedFuncs,
      summary,
      highlightedNodeIds: Array.from(visitedNodeIds),
      highlightedEdgeIds: Array.from(highlightedEdges)
    };
  }
}

export const blastRadiusEngine = new BlastRadiusEngine();
