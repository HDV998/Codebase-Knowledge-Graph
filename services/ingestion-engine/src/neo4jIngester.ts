import neo4j, { Driver, Session } from 'neo4j-driver';
import { KnowledgeGraphData, BaseNode, GraphEdge } from './types';

export interface Neo4jConfig {
  uri?: string;
  user?: string;
  password?: string;
  database?: string;
}

export class Neo4jIngester {
  private driver: Driver | null = null;
  private config: Required<Neo4jConfig>;

  constructor(config: Neo4jConfig = {}) {
    this.config = {
      uri: config.uri || process.env.NEO4J_URI || 'bolt://localhost:7687',
      user: config.user || process.env.NEO4J_USER || 'neo4j',
      password: config.password || process.env.NEO4J_PASSWORD || 'codebase_kg_secret_password',
      database: config.database || process.env.NEO4J_DATABASE || 'neo4j'
    };
  }

  public async connect(): Promise<boolean> {
    try {
      this.driver = neo4j.driver(
        this.config.uri,
        neo4j.auth.basic(this.config.user, this.config.password),
        { connectionTimeout: 5000 }
      );
      const serverInfo = await this.driver.getServerInfo();
      console.log(`[Neo4jIngester] Connected to Neo4j server at ${this.config.uri} (${serverInfo.agent})`);
      return true;
    } catch (error: any) {
      console.warn(`[Neo4jIngester] Could not connect to Neo4j at ${this.config.uri}: ${error.message}`);
      this.driver = null;
      return false;
    }
  }

  public async close(): Promise<void> {
    if (this.driver) {
      await this.driver.close();
      this.driver = null;
    }
  }

  public async ensureSchema(): Promise<void> {
    if (!this.driver) return;
    const session = this.driver.session({ database: this.config.database });
    try {
      const constraints = [
        'CREATE CONSTRAINT IF NOT EXISTS FOR (r:Repository) REQUIRE r.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (f:File) REQUIRE f.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (c:Class) REQUIRE c.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (fn:Function) REQUIRE fn.id IS UNIQUE',
        'CREATE CONSTRAINT IF NOT EXISTS FOR (t:Test) REQUIRE t.id IS UNIQUE'
      ];
      for (const query of constraints) {
        await session.run(query);
      }
      console.log('[Neo4jIngester] Schema constraints and indexes verified.');
    } finally {
      await session.close();
    }
  }

  public async ingestGraph(graph: KnowledgeGraphData): Promise<{ nodesCount: number; edgesCount: number }> {
    if (!this.driver) {
      throw new Error('Neo4j driver is not connected.');
    }
    const session = this.driver.session({ database: this.config.database });
    try {
      await this.ensureSchema();

      // 1. Ingest Repository Node
      await session.run(
        `MERGE (r:Repository {id: $repo.id})
         SET r.name = $repo.name,
             r.branch = $repo.branch,
             r.url = $repo.url,
             r.totalFiles = $repo.totalFiles,
             r.totalFunctions = $repo.totalFunctions,
             r.totalClasses = $repo.totalClasses,
             r.updatedAt = datetime()`,
        { repo: graph.repository }
      );

      // 2. Ingest Nodes by Label
      const files = graph.nodes.filter(n => n.type === 'File');
      const classes = graph.nodes.filter(n => n.type === 'Class' || n.type === 'Interface');
      const functions = graph.nodes.filter(n => n.type === 'Function');
      const tests = graph.nodes.filter(n => n.type === 'Test');

      if (files.length > 0) {
        await session.run(
          `UNWIND $batch AS f
           MERGE (node:File {id: f.id})
           SET node.name = f.name,
               node.path = f.path,
               node.filePath = f.filePath,
               node.repoId = f.repoId,
               node.extension = f.extension,
               node.language = f.language,
               node.lineCount = f.lineCount,
               node.sizeBytes = f.sizeBytes,
               node.exports = f.exports`,
          { batch: files }
        );
      }

      if (classes.length > 0) {
        await session.run(
          `UNWIND $batch AS c
           MERGE (node:Class {id: c.id})
           SET node.name = c.name,
               node.type = c.type,
               node.repoId = c.repoId,
               node.filePath = c.filePath,
               node.startLine = c.startLine,
               node.endLine = c.endLine,
               node.isExported = c.isExported,
               node.extendsClass = c.extendsClass,
               node.methods = c.methods`,
          { batch: classes }
        );
      }

      if (functions.length > 0) {
        await session.run(
          `UNWIND $batch AS fn
           MERGE (node:Function {id: fn.id})
           SET node.name = fn.name,
               node.signature = fn.signature,
               node.returnType = fn.returnType,
               node.parameters = fn.parameters,
               node.repoId = fn.repoId,
               node.filePath = fn.filePath,
               node.startLine = fn.startLine,
               node.endLine = fn.endLine,
               node.isAsync = fn.isAsync,
               node.isExported = fn.isExported,
               node.isMethod = fn.isMethod,
               node.parentClass = fn.parentClass,
               node.cyclomaticComplexity = fn.cyclomaticComplexity,
               node.inDegree = fn.inDegree,
               node.outDegree = fn.outDegree,
               node.blastRadiusWeight = fn.blastRadiusWeight,
               node.codeSnippet = fn.codeSnippet`,
          { batch: functions }
        );
      }

      if (tests.length > 0) {
        await session.run(
          `UNWIND $batch AS t
           MERGE (node:Test {id: t.id})
           SET node.name = t.name,
               node.repoId = t.repoId,
               node.filePath = t.filePath,
               node.testFramework = t.testFramework,
               node.testType = t.testType,
               node.targetSymbolNames = t.targetSymbolNames,
               node.startLine = t.startLine,
               node.endLine = t.endLine`,
          { batch: tests }
        );
      }

      // 3. Ingest Edges by Type
      const edgeTypes = ['CONTAINS', 'DEFINES', 'HAS_METHOD', 'EXTENDS', 'IMPORTS', 'CALLS', 'TESTS'];
      for (const eType of edgeTypes) {
        const typeEdges = graph.edges.filter(e => e.type === eType);
        if (typeEdges.length > 0) {
          const cypher = `
            UNWIND $batch AS edge
            MATCH (source {id: edge.source})
            MATCH (target {id: edge.target})
            MERGE (source)-[r:${eType}]->(target)
            SET r.id = edge.id,
                r.line = edge.metadata.line,
                r.importedSymbols = edge.metadata.importedSymbols
          `;
          await session.run(cypher, { batch: typeEdges });
        }
      }

      console.log(`[Neo4jIngester] Successfully loaded ${graph.nodes.length} nodes and ${graph.edges.length} edges for repo '${graph.repository.id}'.`);
      return {
        nodesCount: graph.nodes.length,
        edgesCount: graph.edges.length
      };
    } finally {
      await session.close();
    }
  }
}
