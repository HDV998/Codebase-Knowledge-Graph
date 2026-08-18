'use client';

import React from 'react';
import { X, Code2, Copy, Check, FileCode, Cpu, ShieldAlert } from 'lucide-react';

interface CodeViewerModalProps {
  node: any | null;
  onClose: () => void;
  onAnalyzeBlastRadius: (node: any) => void;
}

export const CodeViewerModal: React.FC<CodeViewerModalProps> = ({
  node,
  onClose,
  onAnalyzeBlastRadius
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!node) return null;

  const handleCopy = () => {
    if (!node.codeSnippet) return;
    navigator.clipboard.writeText(node.codeSnippet);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const lines = node.codeSnippet ? node.codeSnippet.split('\n') : ['// No code snippet available'];
  const startLine = node.startLine || 1;

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-in fade-in duration-150">
      <div className="bg-surface border border-border w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-surface-highlight">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20 text-sky-400">
              <Code2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-sm text-white font-mono">{node.name}</h3>
                <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-surface text-sky-400 border border-sky-500/20">
                  {node.type}
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono">
                📂 {node.filePath} (Lines {node.startLine || 1} - {node.endLine || 1})
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onAnalyzeBlastRadius(node)}
              className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 transition-colors"
            >
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>Blast Radius</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Code Metadata Bar */}
        <div className="px-4 py-2 bg-[#090d16] border-b border-border flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-4">
            {node.cyclomaticComplexity !== undefined && (
              <span>Cyclomatic Complexity: <strong className="text-slate-200">{node.cyclomaticComplexity}</strong></span>
            )}
            {node.inDegree !== undefined && (
              <span>In-Degree: <strong className="text-slate-200">{node.inDegree}</strong></span>
            )}
            {node.blastRadiusWeight !== undefined && (
              <span>Risk Criticality: <strong className="text-amber-400">{node.blastRadiusWeight}</strong></span>
            )}
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            <span>{copied ? 'Copied' : 'Copy Code'}</span>
          </button>
        </div>

        {/* Source Code Viewer */}
        <div className="flex-1 overflow-y-auto p-4 bg-[#060a12] font-mono text-xs text-slate-200">
          <table className="w-full border-collapse">
            <tbody>
              {lines.map((line: string, idx: number) => (
                <tr key={idx} className="hover:bg-slate-800/40">
                  <td className="w-12 pr-4 text-right select-none text-slate-600 font-mono text-[11px]">
                    {startLine + idx}
                  </td>
                  <td className="whitespace-pre font-mono text-slate-200">
                    {line}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
