'use client';

import React from 'react';
import { 
  ShieldAlert, 
  X, 
  Code2, 
  FileCode, 
  FlaskConical, 
  Layers, 
  GitCommit, 
  AlertTriangle, 
  CheckCircle2, 
  ChevronRight, 
  Eye 
} from 'lucide-react';

interface BlastRadiusSidebarProps {
  report: {
    targetNode: any;
    riskScore: number;
    riskLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
    affectedFilesCount: number;
    affectedFunctionsCount: number;
    summary: string;
    impactedNodes: Array<{
      node: any;
      depth: number;
      relationship: string;
      riskContribution: number;
      directPath: string[];
    }>;
    affectedTests: any[];
    highlightedNodeIds: string[];
  } | null;
  onClose: () => void;
  onViewCode: (node: any) => void;
  onFocusSubgraph: (nodeIds: string[]) => void;
}

export const BlastRadiusSidebar: React.FC<BlastRadiusSidebarProps> = ({
  report,
  onClose,
  onViewCode,
  onFocusSubgraph
}) => {
  if (!report) return null;

  const { targetNode, riskScore, riskLevel, affectedFilesCount, affectedFunctionsCount, summary, impactedNodes, affectedTests, highlightedNodeIds } = report;

  const getRiskBadgeStyles = (level: string) => {
    switch (level) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/30';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/30';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/30';
      default:
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30';
    }
  };

  return (
    <div className="absolute left-0 top-0 bottom-0 w-full sm:w-[460px] bg-surface/95 backdrop-blur-xl border-r border-border z-40 flex flex-col shadow-2xl animate-in slide-in-from-left duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface-highlight/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-400">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">Blast Radius & Impact Analysis</h2>
            <p className="text-xs text-slate-400">Transitive dependency & caller risk model</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-highlight transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Target Node Overview */}
      <div className="p-4 border-b border-border bg-[#0b111e]/80">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-bold text-sky-400">{targetNode.name}</span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface text-slate-300 border border-border">
              {targetNode.type}
            </span>
          </div>
          <span className={`text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border ${getRiskBadgeStyles(riskLevel)}`}>
            {riskLevel} RISK ({riskScore} pts)
          </span>
        </div>

        {targetNode.filePath && (
          <p className="text-xs text-slate-400 font-mono mb-3 truncate">
            📂 {targetNode.filePath} (Lines {targetNode.startLine || 1}-{targetNode.endLine || 1})
          </p>
        )}

        <div className="grid grid-cols-3 gap-2 text-center text-xs">
          <div className="bg-surface-highlight p-2 rounded-lg border border-border">
            <span className="text-[10px] text-slate-400 block">Impacted Callers</span>
            <span className="font-bold text-white text-sm">{affectedFunctionsCount}</span>
          </div>
          <div className="bg-surface-highlight p-2 rounded-lg border border-border">
            <span className="text-[10px] text-slate-400 block">Affected Files</span>
            <span className="font-bold text-white text-sm">{affectedFilesCount}</span>
          </div>
          <div className="bg-surface-highlight p-2 rounded-lg border border-border">
            <span className="text-[10px] text-slate-400 block">Covering Tests</span>
            <span className="font-bold text-emerald-400 text-sm">{affectedTests.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-3">
          <button
            onClick={() => onViewCode(targetNode)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-surface-highlight hover:bg-slate-800 text-slate-200 py-1.5 px-3 rounded-lg border border-border transition-colors"
          >
            <Eye className="w-3.5 h-3.5 text-sky-400" />
            <span>Inspect Code AST</span>
          </button>
          <button
            onClick={() => onFocusSubgraph(highlightedNodeIds)}
            className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium bg-sky-500/10 hover:bg-sky-500/20 text-sky-400 py-1.5 px-3 rounded-lg border border-sky-500/30 transition-colors"
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Focus Subgraph</span>
          </button>
        </div>
      </div>

      {/* Traversal Details & Call Tree */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Summary Alert */}
        <div className="bg-surface-highlight/50 p-3 rounded-xl border border-border text-xs text-slate-300 leading-relaxed">
          {summary}
        </div>

        {/* Upstream Callers Waterfall */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Upstream Callers ({impactedNodes.length})
            </span>
          </div>

          {impactedNodes.length === 0 ? (
            <p className="text-xs text-slate-500 italic bg-surface-highlight p-3 rounded-xl border border-border">
              No upstream callers detected. This symbol is either an entrypoint or uncalled.
            </p>
          ) : (
            <div className="space-y-2">
              {impactedNodes.map((item, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b111e] p-3 rounded-xl border border-border hover:border-slate-700 transition-all text-xs"
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <Code2 className="w-3.5 h-3.5 text-amber-400" />
                      <span className="font-mono font-bold text-white">{item.node.name}</span>
                    </div>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-surface-highlight text-sky-400 border border-border">
                      Depth {item.depth}
                    </span>
                  </div>

                  <p className="text-[11px] text-slate-400 font-mono truncate mb-2">
                    📂 {item.node.filePath}
                  </p>

                  <div className="flex items-center gap-1 text-[10px] text-slate-400 bg-surface-highlight px-2 py-1 rounded-md overflow-x-auto">
                    <span className="text-slate-500">Path:</span>
                    {item.directPath.map((p, pIdx) => (
                      <React.Fragment key={pIdx}>
                        {pIdx > 0 && <ChevronRight className="w-3 h-3 text-slate-600 inline" />}
                        <span className={pIdx === item.directPath.length - 1 ? 'text-amber-300 font-semibold' : 'text-slate-300'}>
                          {p}
                        </span>
                      </React.Fragment>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Affected Tests */}
        <div>
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Covering Test Suites ({affectedTests.length})
            </span>
          </div>

          {affectedTests.length === 0 ? (
            <div className="bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 text-xs text-amber-300 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-400" />
              <span>No unit or integration tests directly cover this call graph. Recommend adding tests before modifying.</span>
            </div>
          ) : (
            <div className="space-y-2">
              {affectedTests.map((test, idx) => (
                <div
                  key={idx}
                  className="bg-[#0b111e] p-2.5 rounded-xl border border-border flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <FlaskConical className="w-4 h-4 text-emerald-400" />
                    <div>
                      <span className="font-semibold text-slate-200 block">{test.name}</span>
                      <span className="text-[10px] text-slate-400 font-mono">{test.filePath}</span>
                    </div>
                  </div>
                  <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    {test.testFramework || 'Jest'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
