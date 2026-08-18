import { 
  KnowledgeGraphData, 
  RepositoryNode, 
  FileNode, 
  ClassNode, 
  FunctionNode, 
  TestNode, 
  GraphEdge, 
  ParsedFileResult 
} from './types';

export class GraphBuilder {
  private repoId: string;
  private repoUrl?: string;
  private branch: string;

  constructor(repoId: string, branch = 'main', repoUrl?: string) {
    this.repoId = repoId;
    this.branch = branch;
    this.repoUrl = repoUrl;
  }

  public buildGraph(results: ParsedFileResult[]): KnowledgeGraphData {
    const files: FileNode[] = [];
    const classes: ClassNode[] = [];
    const functions: FunctionNode[] = [];
    const tests: TestNode[] = [];
    const edges: GraphEdge[] = [];

    // Lookup indexes
    const funcNameMap = new Map<string, FunctionNode[]>();
    const fileMap = new Map<string, FileNode>();
    const classMap = new Map<string, ClassNode>();

    // 1. Collect all nodes and construct hierarchy edges
    for (const res of results) {
      files.push(res.file);
      if (res.file.filePath) {
        fileMap.set(res.file.filePath, res.file);
      }

      // Repository -> File (CONTAINS)
      edges.push({
        id: `edge:contains:${this.repoId}:${res.file.id}`,
        source: `repo:${this.repoId}`,
        target: res.file.id,
        type: 'CONTAINS'
      });

      // File -> Class / Interface (DEFINES)
      for (const cls of res.classes) {
        classes.push(cls);
        classMap.set(cls.name, cls);

        edges.push({
          id: `edge:defines:${res.file.id}:${cls.id}`,
          source: res.file.id,
          target: cls.id,
          type: 'DEFINES'
        });

        // Class inheritance
        if (cls.extendsClass) {
          const targetCls = classes.find(c => c.name === cls.extendsClass);
          if (targetCls) {
            edges.push({
              id: `edge:extends:${cls.id}:${targetCls.id}`,
              source: cls.id,
              target: targetCls.id,
              type: 'EXTENDS'
            });
          }
        }
      }

      // File -> Function (DEFINES) or Class -> Function (HAS_METHOD)
      for (const fn of res.functions) {
        functions.push(fn);

        if (!funcNameMap.has(fn.name)) {
          funcNameMap.set(fn.name, []);
        }
        funcNameMap.get(fn.name)!.push(fn);

        if (fn.isMethod && fn.parentClass) {
          const parent = classes.find(c => c.name === fn.parentClass && c.filePath === fn.filePath);
          if (parent) {
            edges.push({
              id: `edge:has_method:${parent.id}:${fn.id}`,
              source: parent.id,
              target: fn.id,
              type: 'HAS_METHOD'
            });
          }
        } else {
          edges.push({
            id: `edge:defines:${res.file.id}:${fn.id}`,
            source: res.file.id,
            target: fn.id,
            type: 'DEFINES'
          });
        }
      }

      // File -> Tests (DEFINES)
      for (const tst of res.tests) {
        tests.push(tst);
        edges.push({
          id: `edge:defines:${res.file.id}:${tst.id}`,
          source: res.file.id,
          target: tst.id,
          type: 'DEFINES'
        });
      }
    }

    // 2. Resolve File Imports (IMPORTS)
    for (const res of results) {
      for (const imp of res.rawImports) {
        // Try resolving target file path
        let targetFile: FileNode | undefined;
        for (const [fPath, fNode] of fileMap.entries()) {
          const normalizedTarget = imp.targetPath.replace(/^(\.\/|\.\.\/)+/, '');
          if (fPath.includes(normalizedTarget)) {
            targetFile = fNode;
            break;
          }
        }

        if (targetFile && targetFile.id !== res.file.id) {
          edges.push({
            id: `edge:imports:${res.file.id}:${targetFile.id}`,
            source: res.file.id,
            target: targetFile.id,
            type: 'IMPORTS',
            metadata: {
              line: imp.line,
              importedSymbols: imp.importedSymbols
            }
          });
        }
      }
    }

    // 3. Resolve Function Calls (CALLS)
    const existingCallEdgeKeys = new Set<string>();

    for (const res of results) {
      for (const rawCall of res.rawCalls) {
        const callerFn = functions.find(f => f.id === rawCall.callerId);
        if (!callerFn) continue;

        // Search for matching target function
        const matchingCallees = funcNameMap.get(rawCall.calleeName);
        if (matchingCallees && matchingCallees.length > 0) {
          // Priority 1: Same file or same class
          let targetFn = matchingCallees.find(f => f.filePath === callerFn.filePath);
          
          // Priority 2: In an imported file
          if (!targetFn) {
            const importedFiles = edges
              .filter(e => e.source === res.file.id && e.type === 'IMPORTS')
              .map(e => e.target);
            targetFn = matchingCallees.find(f => {
              const fNodeId = `file:${this.repoId}:${f.filePath}`;
              return importedFiles.includes(fNodeId);
            });
          }

          // Priority 3: Fallback to first matching exported function
          if (!targetFn) {
            targetFn = matchingCallees[0];
          }

          if (targetFn && targetFn.id !== callerFn.id) {
            const edgeKey = `${callerFn.id}->${targetFn.id}`;
            if (!existingCallEdgeKeys.has(edgeKey)) {
              existingCallEdgeKeys.add(edgeKey);
              edges.push({
                id: `edge:calls:${callerFn.id}:${targetFn.id}`,
                source: callerFn.id,
                target: targetFn.id,
                type: 'CALLS',
                metadata: {
                  line: rawCall.line
                }
              });
            }
          }
        }
      }
    }

    // 4. Resolve Test Coverage (TESTS)
    for (const tst of tests) {
      for (const targetName of tst.targetSymbolNames) {
        const matchingFns = funcNameMap.get(targetName);
        if (matchingFns) {
          for (const fn of matchingFns) {
            edges.push({
              id: `edge:tests:${tst.id}:${fn.id}`,
              source: tst.id,
              target: fn.id,
              type: 'TESTS'
            });
          }
        }
        const matchingCls = classMap.get(targetName);
        if (matchingCls) {
          edges.push({
            id: `edge:tests:${tst.id}:${matchingCls.id}`,
            source: tst.id,
            target: matchingCls.id,
            type: 'TESTS'
          });
        }
      }
    }

    // 5. Compute Degree & Blast Radius Weights for Functions
    const inDegreeMap = new Map<string, number>();
    const outDegreeMap = new Map<string, number>();

    for (const edge of edges) {
      if (edge.type === 'CALLS') {
        outDegreeMap.set(edge.source, (outDegreeMap.get(edge.source) || 0) + 1);
        inDegreeMap.set(edge.target, (inDegreeMap.get(edge.target) || 0) + 1);
      }
    }

    for (const fn of functions) {
      fn.inDegree = inDegreeMap.get(fn.id) || 0;
      fn.outDegree = outDegreeMap.get(fn.id) || 0;
      // Criticality / Blast Radius Formula: inDegree * 2.5 + outDegree * 1.2 + complexity * 0.5
      fn.blastRadiusWeight = Number((fn.inDegree * 2.5 + fn.outDegree * 1.2 + (fn.cyclomaticComplexity || 1) * 0.4).toFixed(2));
    }

    const repository: RepositoryNode = {
      id: `repo:${this.repoId}`,
      name: this.repoId,
      type: 'Repository',
      repoId: this.repoId,
      branch: this.branch,
      url: this.repoUrl || `https://github.com/org/${this.repoId}`,
      totalFiles: files.length,
      totalFunctions: functions.length,
      totalClasses: classes.length
    };

    return {
      repository,
      nodes: [...files, ...classes, ...functions, ...tests],
      edges
    };
  }
}
