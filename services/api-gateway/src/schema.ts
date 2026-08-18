export const typeDefs = `#graphql
  enum NodeType {
    Repository
    Module
    File
    Class
    Interface
    Function
    Test
    APIEndpoint
  }

  enum RelationshipType {
    CONTAINS
    DEFINES
    HAS_METHOD
    EXTENDS
    IMPLEMENTS
    IMPORTS
    CALLS
    TESTS
    EXPOSES
  }

  enum Direction {
    UPSTREAM
    DOWNSTREAM
    BOTH
  }

  enum RiskLevel {
    LOW
    MEDIUM
    HIGH
    CRITICAL
  }

  type Repository {
    id: ID!
    name: String!
    branch: String!
    url: String
    totalFiles: Int!
    totalFunctions: Int!
    totalClasses: Int!
    updatedAt: String
  }

  type GraphNode {
    id: ID!
    name: String!
    type: NodeType!
    repoId: String!
    filePath: String
    extension: String
    language: String
    lineCount: Int
    signature: String
    returnType: String
    parameters: [String!]
    startLine: Int
    endLine: Int
    isAsync: Boolean
    isExported: Boolean
    isMethod: Boolean
    parentClass: String
    cyclomaticComplexity: Float
    inDegree: Int
    outDegree: Int
    blastRadiusWeight: Float
    codeSnippet: String
    testFramework: String
    testType: String
    targetSymbolNames: [String!]
  }

  type GraphEdge {
    id: ID!
    source: String!
    target: String!
    type: RelationshipType!
    line: Int
    importedSymbols: [String!]
  }

  type GraphData {
    nodes: [GraphNode!]!
    edges: [GraphEdge!]!
  }

  type ImpactNode {
    node: GraphNode!
    depth: Int!
    relationship: String!
    riskContribution: Float!
    directPath: [String!]!
  }

  type BlastRadiusReport {
    targetNode: GraphNode!
    riskScore: Float!
    riskLevel: RiskLevel!
    impactedNodes: [ImpactNode!]!
    affectedTests: [GraphNode!]!
    affectedFilesCount: Int!
    affectedFunctionsCount: Int!
    summary: String!
    highlightedNodeIds: [String!]!
    highlightedEdgeIds: [String!]!
  }

  type NaturalLanguageQueryResult {
    question: String!
    answer: String!
    cypherQuery: String!
    explanation: String!
    resultCount: Int!
    highlightedNodeIds: [String!]!
    subgraph: GraphData!
    confidenceScore: Float!
  }

  type RepoStats {
    repoId: String!
    totalNodes: Int!
    totalEdges: Int!
    totalFiles: Int!
    totalFunctions: Int!
    totalClasses: Int!
    totalTests: Int!
    averageComplexity: Float!
    mostCriticalFunctions: [GraphNode!]!
  }

  input FileInput {
    path: String!
    content: String!
  }

  type IngestResponse {
    success: Boolean!
    message: String!
    nodesCount: Int!
    edgesCount: Int!
    repoId: String!
  }

  type Query {
    repositories: [Repository!]!
    repository(id: ID!): Repository
    graphData(repoId: ID!, filterType: String, limit: Int): GraphData!
    blastRadius(nodeId: ID!, repoId: ID!, maxDepth: Int, direction: Direction): BlastRadiusReport!
    askCodebase(question: String!, repoId: ID!): NaturalLanguageQueryResult!
    nodeDetails(id: ID!, repoId: ID!): GraphNode
    stats(repoId: ID!): RepoStats!
    searchNodes(repoId: ID!, query: String!, type: NodeType): [GraphNode!]!
  }

  type Mutation {
    ingestSampleRepo(sampleId: String!): IngestResponse!
    ingestCustomCodebase(repoId: String!, files: [FileInput!]!): IngestResponse!
    clearGraph(repoId: ID): Boolean!
  }
`;
