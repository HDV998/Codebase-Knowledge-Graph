export interface GraphQLResponse<T = any> {
  data?: T;
  errors?: Array<{ message: string }>;
}

const GRAPHQL_ENDPOINT = process.env.NEXT_PUBLIC_GRAPHQL_ENDPOINT || 'http://localhost:4000/graphql';

export async function fetchGraphQL<T = any>(query: string, variables: Record<string, any> = {}, signal?: AbortSignal): Promise<T> {
  try {
    const res = await fetch(GRAPHQL_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query, variables }),
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000)
    });

    if (!res.ok) {
      throw new Error(`GraphQL request failed with HTTP ${res.status}: ${res.statusText}`);
    }

    const result: GraphQLResponse<T> = await res.json();
    if (result.errors && result.errors.length > 0) {
      throw new Error(result.errors[0].message);
    }

    return result.data as T;
  } catch (error: any) {
    throw error;
  }
}

// Predefined GraphQL Queries
export const GET_GRAPH_DATA_QUERY = `
  query GetGraphData($repoId: ID!, $filterType: String, $limit: Int) {
    repositories {
      id
      name
      branch
      totalFiles
      totalFunctions
      totalClasses
    }
    graphData(repoId: $repoId, filterType: $filterType, limit: $limit) {
      nodes {
        id
        name
        type
        repoId
        filePath
        extension
        language
        lineCount
        signature
        returnType
        parameters
        startLine
        endLine
        isAsync
        isExported
        isMethod
        parentClass
        cyclomaticComplexity
        inDegree
        outDegree
        blastRadiusWeight
        codeSnippet
        testFramework
        testType
      }
      edges {
        id
        source
        target
        type
        line
      }
    }
    stats(repoId: $repoId) {
      repoId
      totalNodes
      totalEdges
      totalFiles
      totalFunctions
      totalClasses
      totalTests
      averageComplexity
    }
  }
`;

export const ASK_CODEBASE_QUERY = `
  query AskCodebase($question: String!, $repoId: ID!) {
    askCodebase(question: $question, repoId: $repoId) {
      question
      answer
      cypherQuery
      explanation
      resultCount
      highlightedNodeIds
      confidenceScore
      subgraph {
        nodes {
          id
          name
          type
          filePath
        }
        edges {
          id
          source
          target
          type
        }
      }
    }
  }
`;

export const GET_BLAST_RADIUS_QUERY = `
  query GetBlastRadius($nodeId: ID!, $repoId: ID!, $maxDepth: Int, $direction: Direction) {
    blastRadius(nodeId: $nodeId, repoId: $repoId, maxDepth: $maxDepth, direction: $direction) {
      targetNode {
        id
        name
        type
        filePath
        signature
        startLine
        endLine
        cyclomaticComplexity
        blastRadiusWeight
        codeSnippet
      }
      riskScore
      riskLevel
      affectedFilesCount
      affectedFunctionsCount
      summary
      highlightedNodeIds
      highlightedEdgeIds
      impactedNodes {
        node {
          id
          name
          type
          filePath
          blastRadiusWeight
        }
        depth
        relationship
        riskContribution
        directPath
      }
      affectedTests {
        id
        name
        testFramework
        testType
        filePath
      }
    }
  }
`;
