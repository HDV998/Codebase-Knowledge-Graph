"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.CodeParser = void 0;
const path = __importStar(require("path"));
/**
 * Multi-Language Code AST Parser & Symbol Extractor
 * Parses TypeScript, JavaScript, Python, Go, and Java source files into rich graph entities.
 */
class CodeParser {
    repoId;
    constructor(repoId) {
        this.repoId = repoId;
    }
    /**
     * Parse a single source file into nodes and symbol references
     */
    parseFile(filePath, content) {
        const ext = path.extname(filePath).toLowerCase();
        const fileName = path.basename(filePath);
        const lines = content.split(/\r?\n/);
        const lineCount = lines.length;
        const sizeBytes = Buffer.byteLength(content, 'utf8');
        let language = 'unknown';
        if (['.ts', '.tsx'].includes(ext))
            language = 'typescript';
        else if (['.js', '.jsx', '.mjs', '.cjs'].includes(ext))
            language = 'javascript';
        else if (['.py'].includes(ext))
            language = 'python';
        else if (['.go'].includes(ext))
            language = 'go';
        else if (['.java'].includes(ext))
            language = 'java';
        const fileNodeId = `file:${this.repoId}:${filePath.replace(/\\/g, '/')}`;
        const isTestFile = /((\.|_)(test|spec)\.(ts|js|jsx|tsx|py|go))|(test_.*\.py)$/i.test(fileName) || filePath.includes('/tests/') || filePath.includes('/__tests__/');
        const fileNode = {
            id: fileNodeId,
            name: fileName,
            type: 'File',
            repoId: this.repoId,
            filePath: filePath.replace(/\\/g, '/'),
            path: filePath.replace(/\\/g, '/'),
            extension: ext,
            language,
            lineCount,
            sizeBytes,
            exports: []
        };
        if (language === 'typescript' || language === 'javascript') {
            return this.parseTypeScript(fileNode, content, lines, isTestFile);
        }
        else if (language === 'python') {
            return this.parsePython(fileNode, content, lines, isTestFile);
        }
        else {
            return this.parseGeneric(fileNode, content, lines, isTestFile);
        }
    }
    /**
     * Parses TypeScript & JavaScript source code
     */
    parseTypeScript(file, content, lines, isTestFile) {
        const classes = [];
        const functions = [];
        const tests = [];
        const rawCalls = [];
        const rawImports = [];
        const exportedSymbols = [];
        // 1. Extract Imports
        // e.g., import { a, b } from './module'; or import foo from 'pkg';
        const importRegex = /import\s+(?:(?:(\w+)|(?:\{\s*([\w\s,]+)\s*\}))\s+from\s+)?['"]([^'"]+)['"]/g;
        let match;
        while ((match = importRegex.exec(content)) !== null) {
            const defaultImport = match[1];
            const namedImports = match[2] ? match[2].split(',').map(s => s.trim()).filter(Boolean) : [];
            const symbols = [];
            if (defaultImport)
                symbols.push(defaultImport);
            symbols.push(...namedImports);
            const targetPath = match[3];
            const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
            rawImports.push({
                targetPath,
                importedSymbols: symbols,
                line: lineNum
            });
        }
        // 2. Extract Classes & Interfaces
        const classRegex = /(?:export\s+)?(?:default\s+)?(class|interface)\s+(\w+)(?:\s+extends\s+([\w\s,]+))?(?:\s+implements\s+([\w\s,]+))?\s*\{/g;
        while ((match = classRegex.exec(content)) !== null) {
            const isExported = match[0].includes('export');
            const kind = match[1] === 'interface' ? 'Interface' : 'Class';
            const className = match[2];
            const extendsClass = match[3]?.trim();
            const implementsInterfaces = match[4] ? match[4].split(',').map(s => s.trim()) : [];
            const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
            if (isExported)
                exportedSymbols.push(className);
            const classId = `class:${this.repoId}:${file.filePath}:${className}`;
            classes.push({
                id: classId,
                name: className,
                type: kind,
                repoId: this.repoId,
                filePath: file.filePath,
                startLine: lineNum,
                endLine: Math.min(lineNum + 40, lines.length), // approximate block boundary
                isExported,
                extendsClass,
                implementsInterfaces,
                methods: []
            });
        }
        // 3. Extract Functions & Methods
        // Matches: function name(..), const name = async (...) =>, public async name(..)
        const funcPatterns = [
            // Standard function: function foo(bar: string): void
            /(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{\n]+))?/g,
            // Arrow function / const foo = async (...) =>
            /(?:export\s+)?const\s+(\w+)\s*=\s*(?:async\s*)?\(([^)]*)\)(?:\s*:\s*([^=\n]+))?\s*=>/g,
            // Method in class: async methodName(params) {
            /(?:public|private|protected|static|\s)*\s+(?:async\s+)?(\w+)\s*\(([^)]*)\)(?:\s*:\s*([^\{\n]+))?\s*\{/g
        ];
        for (const pattern of funcPatterns) {
            while ((match = pattern.exec(content)) !== null) {
                const fullMatch = match[0];
                const funcName = match[1];
                // Skip common keywords that match method pattern
                if (['if', 'for', 'while', 'switch', 'catch', 'constructor'].includes(funcName))
                    continue;
                const paramsRaw = match[2] || '';
                const params = paramsRaw.split(',').map(p => p.trim()).filter(Boolean);
                const returnType = match[3]?.trim();
                const isAsync = fullMatch.includes('async');
                const isExported = fullMatch.includes('export');
                const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
                // Determine if method of a class
                const parentClass = classes.find(c => lineNum >= c.startLine && lineNum <= c.endLine);
                if (parentClass) {
                    parentClass.methods.push(funcName);
                }
                if (isExported)
                    exportedSymbols.push(funcName);
                const funcId = `func:${this.repoId}:${file.filePath}:${parentClass ? parentClass.name + '.' : ''}${funcName}`;
                // Extract snippet (up to 15 lines)
                const endLine = Math.min(lineNum + 15, lines.length);
                const snippet = lines.slice(lineNum - 1, endLine).join('\n');
                // Approximate cyclomatic complexity
                const complexity = this.estimateComplexity(snippet);
                functions.push({
                    id: funcId,
                    name: funcName,
                    type: 'Function',
                    repoId: this.repoId,
                    filePath: file.filePath,
                    signature: `${funcName}(${paramsRaw})${returnType ? ': ' + returnType : ''}`,
                    returnType,
                    parameters: params,
                    startLine: lineNum,
                    endLine,
                    isAsync,
                    isExported,
                    isMethod: !!parentClass,
                    parentClass: parentClass?.name,
                    cyclomaticComplexity: complexity,
                    inDegree: 0,
                    outDegree: 0,
                    blastRadiusWeight: 1.0,
                    codeSnippet: snippet
                });
                // 4. Extract Calls inside this function body
                const callRegex = /(?:await\s+)?(?:this\.)?(?:[a-zA-Z0-9_$]+\.)?([a-zA-Z0-9_$]+)\s*\(/g;
                let callMatch;
                while ((callMatch = callRegex.exec(snippet)) !== null) {
                    const calleeName = callMatch[1];
                    if (!['if', 'for', 'while', 'switch', 'catch', 'require', 'import', 'console', 'log', 'push', 'map', 'filter', 'reduce', 'forEach', 'then', 'catch', 'JSON', 'stringify', 'parse'].includes(calleeName)) {
                        rawCalls.push({
                            callerId: funcId,
                            calleeName,
                            line: lineNum + snippet.substring(0, callMatch.index).split(/\r?\n/).length - 1
                        });
                    }
                }
            }
        }
        // 5. Extract Tests (Jest/Mocha: describe, test, it)
        if (isTestFile) {
            const testRegex = /(describe|it|test)\s*\(\s*['"`]([^'"`]+)['"`]/g;
            while ((match = testRegex.exec(content)) !== null) {
                const type = match[1];
                const testName = match[2];
                const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
                const testId = `test:${this.repoId}:${file.filePath}:${lineNum}`;
                // Find referenced symbols in test name or nearby code
                const referencedWords = testName.split(/[\s,.'":_-]+/).filter(w => w.length > 2);
                tests.push({
                    id: testId,
                    name: testName,
                    type: 'Test',
                    repoId: this.repoId,
                    filePath: file.filePath,
                    testFramework: 'jest',
                    testType: type === 'describe' ? 'integration' : 'unit',
                    targetSymbolNames: referencedWords,
                    startLine: lineNum,
                    endLine: Math.min(lineNum + 20, lines.length)
                });
            }
        }
        file.exports = exportedSymbols;
        return {
            file,
            classes,
            functions,
            tests,
            rawCalls,
            rawImports
        };
    }
    /**
     * Parses Python source code
     */
    parsePython(file, content, lines, isTestFile) {
        const classes = [];
        const functions = [];
        const tests = [];
        const rawCalls = [];
        const rawImports = [];
        // 1. Imports
        const pyImportRegex = /(?:from\s+([\w\.]+)\s+import\s+([\w\s,\*]+))|(?:import\s+([\w\.]+))/g;
        let match;
        while ((match = pyImportRegex.exec(content)) !== null) {
            const targetPath = match[1] || match[3];
            const symbols = match[2] ? match[2].split(',').map(s => s.trim()) : [targetPath];
            const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
            rawImports.push({
                targetPath,
                importedSymbols: symbols,
                line: lineNum
            });
        }
        // 2. Classes
        const classRegex = /class\s+(\w+)(?:\(([^)]+)\))?\s*:/g;
        while ((match = classRegex.exec(content)) !== null) {
            const className = match[1];
            const baseClass = match[2]?.trim();
            const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
            const classId = `class:${this.repoId}:${file.filePath}:${className}`;
            classes.push({
                id: classId,
                name: className,
                type: 'Class',
                repoId: this.repoId,
                filePath: file.filePath,
                startLine: lineNum,
                endLine: Math.min(lineNum + 50, lines.length),
                isExported: true,
                extendsClass: baseClass,
                methods: []
            });
        }
        // 3. Functions / Methods
        const funcRegex = /(?:async\s+)?def\s+(\w+)\s*\(([^)]*)\)(?:\s*->\s*([^:]+))?\s*:/g;
        while ((match = funcRegex.exec(content)) !== null) {
            const funcName = match[1];
            const paramsRaw = match[2] || '';
            const params = paramsRaw.split(',').map(p => p.trim()).filter(Boolean);
            const returnType = match[3]?.trim();
            const isAsync = match[0].startsWith('async');
            const lineNum = content.substring(0, match.index).split(/\r?\n/).length;
            const parentClass = classes.find(c => lineNum >= c.startLine && lineNum <= c.endLine);
            if (parentClass)
                parentClass.methods.push(funcName);
            const funcId = `func:${this.repoId}:${file.filePath}:${parentClass ? parentClass.name + '.' : ''}${funcName}`;
            const endLine = Math.min(lineNum + 20, lines.length);
            const snippet = lines.slice(lineNum - 1, endLine).join('\n');
            const complexity = this.estimateComplexity(snippet);
            if (funcName.startsWith('test_') || isTestFile) {
                tests.push({
                    id: `test:${this.repoId}:${file.filePath}:${lineNum}`,
                    name: funcName,
                    type: 'Test',
                    repoId: this.repoId,
                    filePath: file.filePath,
                    testFramework: 'pytest',
                    testType: 'unit',
                    targetSymbolNames: [funcName.replace(/^test_/, '')],
                    startLine: lineNum,
                    endLine
                });
            }
            functions.push({
                id: funcId,
                name: funcName,
                type: 'Function',
                repoId: this.repoId,
                filePath: file.filePath,
                signature: `def ${funcName}(${paramsRaw})${returnType ? ' -> ' + returnType : ''}`,
                returnType,
                parameters: params,
                startLine: lineNum,
                endLine,
                isAsync,
                isExported: !funcName.startsWith('_'),
                isMethod: !!parentClass,
                parentClass: parentClass?.name,
                cyclomaticComplexity: complexity,
                inDegree: 0,
                outDegree: 0,
                blastRadiusWeight: 1.0,
                codeSnippet: snippet
            });
            // Raw calls
            const callRegex = /([a-zA-Z0-9_]+)\s*\(/g;
            let callMatch;
            while ((callMatch = callRegex.exec(snippet)) !== null) {
                const calleeName = callMatch[1];
                if (!['def', 'class', 'if', 'for', 'while', 'print', 'len', 'range', 'str', 'int', 'list', 'dict', 'set', 'isinstance', 'super'].includes(calleeName)) {
                    rawCalls.push({
                        callerId: funcId,
                        calleeName,
                        line: lineNum
                    });
                }
            }
        }
        return {
            file,
            classes,
            functions,
            tests,
            rawCalls,
            rawImports
        };
    }
    /**
     * Generic fallback parser for other languages
     */
    parseGeneric(file, content, lines, isTestFile) {
        return {
            file,
            classes: [],
            functions: [],
            tests: [],
            rawCalls: [],
            rawImports: []
        };
    }
    /**
     * Estimate cyclomatic complexity by branching keyword density
     */
    estimateComplexity(code) {
        let complexity = 1;
        const branches = /\b(if|else\s+if|elif|for|while|case|catch|except|&&|\|\||\?)\b/g;
        const matches = code.match(branches);
        if (matches) {
            complexity += matches.length;
        }
        return complexity;
    }
}
exports.CodeParser = CodeParser;
