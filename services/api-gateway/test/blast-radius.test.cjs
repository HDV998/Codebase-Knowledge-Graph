const assert = require('node:assert/strict');
const test = require('node:test');
const { BlastRadiusEngine } = require('../dist/api-gateway/src/blastRadiusEngine');
const { neo4jService } = require('../dist/api-gateway/src/neo4jClient');

test('indexed traversal handles cycles, depth zero, and affected test targets', () => {
  const repoId = 'cyclic-fixture';
  const nodes = [
    { id: 'a', name: 'caller', type: 'Function', filePath: 'a.ts' },
    { id: 'b', name: 'callee', type: 'Function', filePath: 'b.ts' },
    { id: 't', name: 'spec', type: 'Test', filePath: 'b.test.ts' },
  ];
  const edges = [
    { id: 'ab', source: 'a', target: 'b', type: 'CALLS' },
    { id: 'ba', source: 'b', target: 'a', type: 'CALLS' },
    { id: 'tb', source: 't', target: 'b', type: 'TESTS' },
  ];
  neo4jService.setStore(repoId, { repository: { id: repoId, repoId, name: repoId }, nodes, edges });
  const engine = new BlastRadiusEngine();
  const report = engine.calculateBlastRadius('b', repoId, 3, 'BOTH');
  assert.deepEqual(report.highlightedNodeIds, ['b', 'a']);
  assert.deepEqual(report.affectedTests.map(node => node.id), ['t']);
  assert.equal(report.affectedFilesCount, 2);
  assert.deepEqual(engine.calculateBlastRadius('b', repoId, 0).highlightedNodeIds, ['b']);
  assert.throws(() => engine.calculateBlastRadius('b', repoId, 21), /Traversal depth/);
  assert.throws(() => engine.calculateBlastRadius('b', 'unknown-repo'), /not found/);
  assert.deepEqual(neo4jService.getGraphData(repoId, undefined, 1).edges, []);
  assert.deepEqual(neo4jService.getGraphData('unknown-repo'), { nodes: [], edges: [] });
});

test('every listed sample can be opened and has unique entity and edge IDs', () => {
  for (const repository of neo4jService.getRepositories().filter(repo => repo.type === 'Repository')) {
    const store = neo4jService.getStore(repository.id);
    assert.ok(store, repository.id);
    assert.equal(store.nodes.length, new Set(store.nodes.map(node => node.id)).size);
    assert.equal(store.edges.length, new Set(store.edges.map(edge => edge.id)).size);
    assert.equal(neo4jService.getRepository(repository.id).id, repository.id);
  }
});

test('Apollo serves ready-to-open repository IDs', async () => {
  const { ApolloServer } = require('@apollo/server');
  const { typeDefs } = require('../dist/api-gateway/src/schema');
  const { resolvers } = require('../dist/api-gateway/src/resolvers');
  const server = new ApolloServer({ typeDefs, resolvers });
  try {
    const result = await server.executeOperation({
      query: '{ repositories { id } graphData(repoId: "auth-identity-rbac-service") { nodes { id } } }',
    });
    assert.equal(result.body.kind, 'single');
    assert.equal(result.body.singleResult.errors, undefined);
    assert.ok(result.body.singleResult.data.repositories.some(repo => repo.id === 'auth-identity-rbac-service'));
    assert.ok(result.body.singleResult.data.graphData.nodes.length > 0);
  } finally {
    await server.stop();
  }
});
