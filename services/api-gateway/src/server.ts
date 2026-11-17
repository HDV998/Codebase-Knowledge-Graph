import express from 'express';
import cors from 'cors';
import http from 'http';
import dotenv from 'dotenv';
import { ApolloServer } from '@apollo/server';
import { expressMiddleware } from '@as-integrations/express5';
import { typeDefs } from './schema';
import { resolvers } from './resolvers';
import { neo4jService } from './neo4jClient';

dotenv.config();

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const port = process.env.PORT || 4000;

  // Initialize Neo4j connection in background
  neo4jService.connect().catch(err => {
    console.warn(`[Server] Neo4j init warning: ${err.message}`);
  });

  const server = new ApolloServer({
    typeDefs,
    resolvers,
    introspection: true
  });

  await server.start();

  app.use(cors({
    origin: process.env.CORS_ORIGIN || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/
  }));
  app.use(express.json({ limit: '2mb' }));

  // Health check endpoint
  app.get('/health', (req, res) => {
    res.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
      neo4jConnected: neo4jService.getConnected()
    });
  });

  // Apollo GraphQL Endpoint
  app.use('/graphql', expressMiddleware(server));

  httpServer.listen(port, () => {
    console.log(`\n======================================================`);
    console.log(`🚀 Codebase Knowledge Graph GraphQL API Gateway active`);
    console.log(`🔗 Endpoint:  http://localhost:${port}/graphql`);
    console.log(`🩺 Health:    http://localhost:${port}/health`);
    console.log(`======================================================\n`);
  });
}

startServer().catch(err => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
