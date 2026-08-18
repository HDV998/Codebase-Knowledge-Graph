export type NodeType = 'Repository' | 'Module' | 'File' | 'Class' | 'Interface' | 'Function' | 'Test' | 'APIEndpoint';

export type RelationshipType = 
  | 'CONTAINS'      // Repo -> Module / File
  | 'DEFINES'       // File -> Class / Function / Interface
  | 'HAS_METHOD'    // Class -> Function
  | 'EXTENDS'       // Class -> Class
  | 'IMPLEMENTS'    // Class -> Interface
  | 'IMPORTS'       // File -> File / Module
  | 'CALLS'         // Function -> Function
  | 'TESTS'         // Test -> Function / Class / File
  | 'EXPOSES';      // Function -> APIEndpoint

export interface BaseNode {
  id: string;
  name: string;
  type: NodeType;
  repoId: string;
  filePath?: string;
  metadata?: Record<string, any>;
}

export interface RepositoryNode extends BaseNode {
  type: 'Repository';
  url?: string;
  branch: string;
  totalFiles: number;
  totalFunctions: number;
  totalClasses: number;
}

export interface ModuleNode extends BaseNode {
  type: 'Module';
  path: string;
  fileCount: number;
}

export interface FileNode extends BaseNode {
  type: 'File';
  path: string;
  extension: string;
  language: string;
  lineCount: number;
  sizeBytes: number;
  exports: string[];
}

export interface ClassNode extends BaseNode {
  type: 'Class' | 'Interface';
  startLine: number;
  endLine: number;
  isExported: boolean;
  extendsClass?: string;
  implementsInterfaces?: string[];
  methods: string[];
}

export interface FunctionNode extends BaseNode {
  type: 'Function';
  signature: string;
  returnType?: string;
  parameters: string[];
  startLine: number;
  endLine: number;
  isAsync: boolean;
  isExported: boolean;
  isMethod: boolean;
  parentClass?: string;
  cyclomaticComplexity: number;
  inDegree: number;
  outDegree: number;
  blastRadiusWeight: number; // calculated score of criticality
  codeSnippet?: string;
}

export interface TestNode extends BaseNode {
  type: 'Test';
  testFramework: 'jest' | 'mocha' | 'pytest' | 'unittest' | 'go_test';
  testType: 'unit' | 'integration' | 'e2e';
  targetSymbolNames: string[];
  startLine: number;
  endLine: number;
}

export interface GraphEdge {
  id: string;
  source: string; // source node ID
  target: string; // target node ID
  type: RelationshipType;
  metadata?: {
    line?: number;
    callCount?: number;
    importedSymbols?: string[];
    [key: string]: any;
  };
}

export interface KnowledgeGraphData {
  repository: RepositoryNode;
  nodes: (FileNode | ClassNode | FunctionNode | TestNode | ModuleNode)[];
  edges: GraphEdge[];
}

export interface ParsedFileResult {
  file: FileNode;
  classes: ClassNode[];
  functions: FunctionNode[];
  tests: TestNode[];
  rawCalls: { callerId: string; calleeName: string; line: number }[];
  rawImports: { targetPath: string; importedSymbols: string[]; line: number }[];
}
