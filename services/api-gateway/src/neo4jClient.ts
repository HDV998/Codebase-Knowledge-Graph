import neo4j, { Driver, Session } from 'neo4j-driver';
import { SAMPLE_CODEBASES, loadSampleCodebaseGraph } from '../../ingestion-engine/src/sampleCodebases';
import { KnowledgeGraphData, BaseNode, GraphEdge, FunctionNode, FileNode } from '../../ingestion-engine/src/types';

export class Neo4jService {
  private driver: Driver | null = null;
  private isConnected = false;
  private inMemoryStores = new Map<string, KnowledgeGraphData>();

  constructor() {
    this.initInMemoryData();
  }

  private initInMemoryData() {
    for (const sample of SAMPLE_CODEBASES) {
      const graph = loadSampleCodebaseGraph(sample.id);
      this.inMemoryStores.set(sample.id, graph);
    }
  }

  public async connect(): Promise<boolean> {
    const uri = process.env.NEO4J_URI || 'bolt://localhost:7687';
    const user = process.env.NEO4J_USER || 'neo4j';
    const password = process.env.NEO4J_PASSWORD || 'codebase_kg_secret_password';

    try {
      this.driver = neo4j.driver(uri, neo4j.auth.basic(user, password), {
        connectionTimeout: 4000
      });
      await this.driver.getServerInfo();
      this.isConnected = true;
      console.log(`[Neo4jService] Connected to active Neo4j cluster at ${uri}`);
      return true;
    } catch (err: any) {
      console.log(`[Neo4jService] Neo4j not reachable (${err.message}). Using high-speed embedded graph store.`);
      this.isConnected = false;
      return false;
    }
  }

  public getConnected(): boolean {
    return this.isConnected;
  }

  public getRepositories(): any[] {
    const repos = [];
    for (const [id, store] of this.inMemoryStores.entries()) {
      repos.push(store.repository);
    }
    return repos;
  }

  public getRepository(id: string): any {
    const store = this.inMemoryStores.get(id);
    return store ? store.repository : null;
  }

  public getGraphData(repoId: string, filterType?: string, limit?: number): { nodes: any[]; edges: any[] } {
    const store = this.inMemoryStores.get(repoId) || this.inMemoryStores.get('ecommerce-payment-platform');
    if (!store) return { nodes: [], edges: [] };

    let nodes = store.nodes;
    if (filterType && filterType !== 'ALL') {
      nodes = nodes.filter(n => n.type === filterType);
    }

    const nodeIds = new Set(nodes.map(n => n.id));
    let edges = store.edges.filter(e => nodeIds.has(e.source) && nodeIds.has(e.target));

    if (limit && limit > 0) {
      nodes = nodes.slice(0, limit);
      const limitedIds = new Set(nodes.map(n => n.id));
      edges = edges.filter(e => limitedIds.has(e.source) && limitedIds.has(e.target));
    }

    return { nodes, edges };
  }

  public getNodeById(id: string, repoId: string): any {
    const store = this.inMemoryStores.get(repoId) || this.inMemoryStores.get('ecommerce-payment-platform');
    if (!store) return null;
    return store.nodes.find(n => n.id === id || n.name === id);
  }

  public getStore(repoId: string): KnowledgeGraphData | undefined {
    return this.inMemoryStores.get(repoId) || this.inMemoryStores.get('ecommerce-payment-platform');
  }

  public setStore(repoId: string, data: KnowledgeGraphData) {
    this.inMemoryStores.set(repoId, data);
  }

  public async runCypher(query: string, params: Record<string, any> = {}): Promise<any[]> {
    if (this.isConnected && this.driver) {
      const session = this.driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
      try {
        const result = await session.run(query, params);
        return result.records.map(r => r.toObject());
      } finally {
        await session.close();
      }
    }
    return [];
  }
}

export const neo4jService = new Neo4jService();
