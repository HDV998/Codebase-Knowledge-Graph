import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';
import { Command } from 'commander';
import { CodeParser } from './parser';
import { GraphBuilder } from './graphBuilder';
import { Neo4jIngester } from './neo4jIngester';
import { ParsedFileResult } from './types';
import { SAMPLE_CODEBASES, loadSampleCodebaseGraph } from './sampleCodebases';

const program = new Command();

program
  .name('codebase-kg-ingest')
  .description('Ingest and parse source code repositories into Neo4j graph database')
  .version('1.0.0');

program
  .command('parse')
  .description('Parse a directory and output graph metrics')
  .argument('<targetPath>', 'Path to codebase directory')
  .option('-r, --repo-id <id>', 'Repository identifier', 'local-repo')
  .option('-b, --branch <branch>', 'Git branch', 'main')
  .option('-o, --output <file>', 'Output graph JSON to file')
  .option('--neo4j', 'Also load into Neo4j database', false)
  .action(async (targetPath, options) => {
    const resolvedPath = path.resolve(targetPath);
    console.log(`[Ingest] Scanning directory: ${resolvedPath}`);

    if (!fs.existsSync(resolvedPath)) {
      console.error(`Error: Directory ${resolvedPath} does not exist.`);
      process.exit(1);
    }

    const files = await glob('**/*.{ts,tsx,js,jsx,py,go,java}', {
      cwd: resolvedPath,
      ignore: ['**/node_modules/**', '**/.git/**', '**/dist/**', '**/build/**', '**/venv/**']
    });

    console.log(`[Ingest] Found ${files.length} code files. Parsing AST...`);

    const parser = new CodeParser(options.repoId);
    const parsedResults: ParsedFileResult[] = [];

    for (const relFile of files) {
      const absFile = path.join(resolvedPath, relFile);
      const content = fs.readFileSync(absFile, 'utf8');
      const parsed = parser.parseFile(relFile, content);
      parsedResults.push(parsed);
    }

    const builder = new GraphBuilder(options.repoId, options.branch);
    const graph = builder.buildGraph(parsedResults);

    console.log(`\n================ GRAPH SUMMARY ================`);
    console.log(`Repo ID:       ${graph.repository.id}`);
    console.log(`Total Files:   ${graph.repository.totalFiles}`);
    console.log(`Total Classes: ${graph.repository.totalClasses}`);
    console.log(`Total Functions: ${graph.repository.totalFunctions}`);
    console.log(`Total Edges:   ${graph.edges.length}`);
    console.log(`===============================================\n`);

    if (options.output) {
      const outPath = path.resolve(options.output);
      fs.writeFileSync(outPath, JSON.stringify(graph, null, 2));
      console.log(`Graph written to ${outPath}`);
    }

    if (options.neo4j) {
      console.log(`[Ingest] Connecting to Neo4j...`);
      const ingester = new Neo4jIngester();
      const connected = await ingester.connect();
      if (connected) {
        await ingester.ingestGraph(graph);
        await ingester.close();
      } else {
        console.warn(`[Ingest] Skipped Neo4j load due to connection failure.`);
      }
    }
  });

program
  .command('seed-samples')
  .description('Seed built-in sample codebases into Neo4j')
  .action(async () => {
    console.log(`[Seed] Ingesting ${SAMPLE_CODEBASES.length} sample repositories into graph...`);
    const ingester = new Neo4jIngester();
    const connected = await ingester.connect();

    for (const sample of SAMPLE_CODEBASES) {
      console.log(`\n[Seed] Building graph for '${sample.name}' (${sample.id})...`);
      const graph = loadSampleCodebaseGraph(sample.id);
      console.log(`  -> ${graph.nodes.length} nodes, ${graph.edges.length} edges`);

      if (connected) {
        await ingester.ingestGraph(graph);
      }
    }

    if (connected) {
      await ingester.close();
    } else {
      console.log(`[Seed] Samples parsed in-memory. Neo4j offline.`);
    }
  });

program.parse(process.argv);
