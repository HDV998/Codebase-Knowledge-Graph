import { neo4jService } from './neo4jClient';
import { blastRadiusEngine } from './blastRadiusEngine';
import { aiEngine } from './aiEngine';
import { CodeParser } from '../../ingestion-engine/src/parser';
import { GraphBuilder } from '../../ingestion-engine/src/graphBuilder';
import { loadSampleCodebaseGraph } from '../../ingestion-engine/src/sampleCodebases';

export const resolvers = {
  Query: {
    repositories: () => {
      return neo4jService.getRepositories();
    },

    repository: (_: any, { id }: { id: string }) => {
      return neo4jService.getRepository(id);
    },

    graphData: (_: any, { repoId, filterType, limit }: { repoId: string; filterType?: string; limit?: number }) => {
      return neo4jService.getGraphData(repoId, filterType, limit);
    },

    blastRadius: (_: any, { nodeId, repoId, maxDepth, direction }: { nodeId: string; repoId: string; maxDepth?: number; direction?: 'UPSTREAM' | 'DOWNSTREAM' | 'BOTH' }) => {
      return blastRadiusEngine.calculateBlastRadius(nodeId, repoId, maxDepth || 3, direction || 'UPSTREAM');
    },

    askCodebase: async (_: any, { question, repoId }: { question: string; repoId: string }) => {
      return await aiEngine.queryCodebase(question, repoId);
    },

    nodeDetails: (_: any, { id, repoId }: { id: string; repoId: string }) => {
      return neo4jService.getNodeById(id, repoId);
    },

    stats: (_: any, { repoId }: { repoId: string }) => {
      const store = neo4jService.getStore(repoId);
      if (!store) throw new Error(`Repository ${repoId} not found`);

      const functions = store.nodes.filter(n => n.type === 'Function');
      const files = store.nodes.filter(n => n.type === 'File');
      const classes = store.nodes.filter(n => n.type === 'Class' || n.type === 'Interface');
      const tests = store.nodes.filter(n => n.type === 'Test');

      const totalComplexity = functions.reduce((acc, f: any) => acc + (f.cyclomaticComplexity || 1), 0);
      const avgComplexity = functions.length > 0 ? Number((totalComplexity / functions.length).toFixed(2)) : 1.0;

      const topCritical = [...functions]
        .sort((a: any, b: any) => (b.blastRadiusWeight || 0) - (a.blastRadiusWeight || 0))
        .slice(0, 5);

      return {
        repoId,
        totalNodes: store.nodes.length,
        totalEdges: store.edges.length,
        totalFiles: files.length,
        totalFunctions: functions.length,
        totalClasses: classes.length,
        totalTests: tests.length,
        averageComplexity: avgComplexity,
        mostCriticalFunctions: topCritical
      };
    },

    searchNodes: (_: any, { repoId, query, type }: { repoId: string; query: string; type?: string }) => {
      const store = neo4jService.getStore(repoId);
      if (!store) return [];

      const q = query.toLowerCase();
      return store.nodes.filter(n => {
        const matchesType = !type || n.type === type;
        const matchesQuery = n.name.toLowerCase().includes(q) || (n.filePath && n.filePath.toLowerCase().includes(q));
        return matchesType && matchesQuery;
      });
    }
  },

  Mutation: {
    ingestSampleRepo: async (_: any, { sampleId }: { sampleId: string }) => {
      const graph = loadSampleCodebaseGraph(sampleId);
      neo4jService.setStore(sampleId, graph);
      return {
        success: true,
        message: `Successfully loaded sample repository '${sampleId}'`,
        nodesCount: graph.nodes.length,
        edgesCount: graph.edges.length,
        repoId: sampleId
      };
    },

    ingestCustomCodebase: async (_: any, { repoId, files }: { repoId: string; files: { path: string; content: string }[] }) => {
      const parser = new CodeParser(repoId);
      const parsedResults = [];

      for (const file of files) {
        parsedResults.push(parser.parseFile(file.path, file.content));
      }

      const builder = new GraphBuilder(repoId, 'main');
      const graph = builder.buildGraph(parsedResults);
      neo4jService.setStore(repoId, graph);

      return {
        success: true,
        message: `Successfully ingested custom codebase with ${files.length} files.`,
        nodesCount: graph.nodes.length,
        edgesCount: graph.edges.length,
        repoId
      };
    },

    clearGraph: async (_: any, { repoId }: { repoId?: string }) => {
      return true;
    }
  }
};
