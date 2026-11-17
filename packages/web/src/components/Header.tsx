'use client';

import React from 'react';
import { GitBranch, Network, PlusCircle, Sparkles } from 'lucide-react';

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
    <header className="graph-header">
      {/* Left: Brand & Repo Selector */}
      <div className="graph-header-group">
        <div className="flex items-center gap-2.5">
          <div className="graph-brand-icon">
            <Network className="w-5 h-5 text-[#09211f]" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-bold text-base tracking-tight text-white">Codebase Knowledge Graph</h1>
            </div>
          </div>
        </div>

        <div className="h-6 w-px bg-border hidden sm:block" />

        {/* Repository Dropdown */}
        <div className="flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-slate-400" />
          <select
            aria-label="Repository"
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

      <div className="graph-header-group">
        <label htmlFor="entity-type">Entity type</label>
        <select id="entity-type" value={filterType} onChange={(event) => onFilterChange(event.target.value)}>
          <option value="ALL">All entities</option>
          <option value="Function">Functions</option>
          <option value="Class">Classes</option>
          <option value="File">Files</option>
          <option value="Test">Tests</option>
        </select>
      </div>
      <div className="graph-header-group">
        {stats && (
          <div className="hidden xl:flex items-center gap-4 text-xs text-slate-400 pr-3 border-r border-border">
            <div className="flex items-center gap-1.5">

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
          <span>Ingest code</span>
        </button>

        <button
          aria-pressed={isCopilotOpen}
          onClick={onToggleCopilot}
          className={`flex items-center gap-2 text-xs font-semibold px-3.5 py-1.5 rounded-lg transition-all shadow-md ${
            isCopilotOpen
              ? 'bg-gradient-to-r from-sky-500 to-indigo-600 text-white shadow-sky-500/25 ring-2 ring-sky-400/30'
              : 'bg-gradient-to-r from-sky-600 to-indigo-600 hover:from-sky-500 hover:to-indigo-500 text-white'
          }`}
        >
          <Sparkles className="w-4 h-4 text-yellow-300" />
          <span>Ask codebase</span>
        </button>
      </div>
    </header>
  );
};
