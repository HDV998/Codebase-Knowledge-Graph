'use client';

import React from 'react';
import { 
  GitBranch, 
  Layers, 
  Database, 
  Sparkles, 
  PlusCircle, 
  ShieldAlert, 
  Network, 
  Cpu, 
  Code2, 
  FolderTree, 
  CheckCircle2, 
  FlaskConical 
} from 'lucide-react';

interface HeaderProps {
  repositories: Array<{ id: string; name: string; branch: string }>;
  selectedRepoId: string;
  onSelectRepo: (id: string) => void;
  stats?: {
    totalNodes: number;
    totalEdges: number;
    totalFiles: number;
    totalFunctions: number;
    totalClasses: number;
    totalTests: number;
    averageComplexity: number;
  };
  filterType: string;
  onFilterChange: (type: string) => void;
  onOpenIngest: () => void;
  onToggleCopilot: () => void;
  isCopilotOpen: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  repositories,
  selectedRepoId,
  onSelectRepo,
  stats,
  filterType,
  onFilterChange,
  onOpenIngest,
  onToggleCopilot,
  isCopilotOpen
}) => {
  return (
    <header className="h-16 border-b border-border bg-surface/90 backdrop-blur-md px-5 flex items-center justify-between z-30 sticky top-0">
      {/* Left: Brand & Repo Selector */}
      <div className="flex items-center gap-5">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-sky-500 via-indigo-500 to-purple-500 flex items-center justify-center shadow-lg shadow-sky-500/20">
            <Network className="w-5 h-5 text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-base tracking-tight text-white">Codebase KG</span>
              <span className="text-[10px] uppercase tracking-wider font-semibold px-2 py-0.5 rounded-full bg-sky-500/10 text-sky-400 border border-sky-500/30">
                Neo4j + AI
              </span>
            </div>
            <p className="text-xs text-slate-400">AST & Call Graph Knowledge Engine</p>
          </div>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Repository Dropdown */}
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select
            value={selectedRepoId}
            onChange={(e) => onSelectRepo(e.target.value)}
            className="bg-surface-highlight text-sm text-slate-200 border border-border rounded-lg px-3 py-1.5 focus:outline-none focus:border-primary transition-colors cursor-pointer"
          >
            {repositories.map((repo) => (
              <option key={repo.id} value={repo.id}>
                {repo.name} ({repo.branch})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Center: Node Filters */}
      <div className="hidden lg:flex items-center gap-1.5 bg-surface-highlight p-1 rounded-xl border border-border text-xs">
        {[
          { label: 'All Entities', value: 'ALL', icon: Layers },
          { label: 'Functions', value: 'Function', icon: Code2, color: 'text-amber-400' },
          { label: 'Classes', value: 'Class', icon: Cpu, color: 'text-purple-400' },
          { label: 'Files', value: 'File', icon: FolderTree, color: 'text-sky-400' },
          { label: 'Tests', value: 'Test', icon: FlaskConical, color: 'text-emerald-400' },
        ].map((item) => {
          const Icon = item.icon;
          const isActive = filterType === item.value;
          return (
            <button
              key={item.value}
              onClick={() => onFilterChange(item.value)}
              className={`flex items-center gap-1.5 px-3 py-1 rounded-lg transition-all ${
                isActive 
                  ? 'bg-sky-500 text-white font-medium shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.color || 'text-slate-400'}`} />
              {item.label}
            </button>
          );
        })}
      </div>

      {/* Right: Actions */}
      <div className="flex items-center gap-3">
        {stats && (
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 pr-3 border-r border-border">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span>{stats.totalNodes} Nodes</span>
            </div>
            <span>{stats.totalEdges} Edges</span>
            <span>{stats.totalTests} Tests</span>
          </div>
        )}

        <button
          onClick={onOpenIngest}
          className="flex items-center gap-1.5 text-xs font-medium text-slate-300 hover:text-white bg-surface-highlight hover:bg-slate-800 border border-border px-3 py-1.5 rounded-lg transition-colors"
        >
          <PlusCircle className="w-4 h-4 text-sky-400" />
          <span>Ingest Repo</span>
        </button>

        <button
          onClick={onToggleCopilot}
          className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow-md ${
            isCopilotOpen
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sky-500/25 ring-2 ring-sky-400/30'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>AI Query Copilot</span>
        </button>
      </div>
    </header>
  );
};
