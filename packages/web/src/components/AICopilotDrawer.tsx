'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  Send, 
  X, 
  Terminal, 
  Copy, 
  Check, 
  ShieldAlert, 
  Layers, 
  Flame, 
  Compass, 
  Loader2 
} from 'lucide-react';
import { fetchGraphQL, ASK_CODEBASE_QUERY } from '../lib/graphqlClient';

interface AICopilotDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  repoId: string;
  onApplySubgraphHighlight: (nodeIds: string[]) => void;
}

export const AICopilotDrawer: React.FC<AICopilotDrawerProps> = ({
  isOpen,
  onClose,
  repoId,
  onApplySubgraphHighlight
}) => {
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [result, setResult] = useState<{
    question: string;
    answer: string;
    cypherQuery: string;
    explanation: string;
    resultCount: number;
    highlightedNodeIds: string[];
    confidenceScore: number;
  } | null>(null);

  const sampleQuestions = [
    "What breaks if I change processPayment?",
    "Show me every place chargeCard is called",
    "What tests cover OrderService?",
    "Which functions have highest risk & complexity?",
    "What is the blast radius of modifying AuthGuard?"
  ];

  const handleAsk = async (queryText: string) => {
    if (!queryText.trim()) return;
    setLoading(true);
    try {
      const data = await fetchGraphQL(ASK_CODEBASE_QUERY, {
        question: queryText,
        repoId
      });
      if (data && data.askCodebase) {
        setResult(data.askCodebase);
        if (data.askCodebase.highlightedNodeIds) {
          onApplySubgraphHighlight(data.askCodebase.highlightedNodeIds);
        }
      }
    } catch (err: any) {
      console.error('AI Query failed:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCypher = () => {
    if (!result?.cypherQuery) return;
    navigator.clipboard.writeText(result.cypherQuery);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed right-0 top-16 bottom-0 w-full sm:w-[480px] bg-surface/95 backdrop-blur-xl border-l border-border z-40 flex flex-col shadow-2xl animate-in slide-in-from-right duration-200">
      {/* Header */}
      <div className="p-4 border-b border-border flex items-center justify-between bg-surface-highlight/50">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-gradient-to-tr from-sky-500 to-indigo-600 shadow-md shadow-sky-500/20">
            <Sparkles className="w-4 h-4 text-white" />
          </div>
          <div>
            <h2 className="font-bold text-sm text-white">AI Codebase Copilot</h2>
            <p className="text-xs text-slate-400">Natural Language ➔ Cypher ➔ Impact Reasoning</p>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-surface-highlight transition-colors"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Main Content / Chat Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Prompt Suggestions */}
        {!result && !loading && (
          <div className="space-y-3 pt-2">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
              Suggested Questions
            </p>
            <div className="space-y-2">
              {sampleQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => {
                    setQuestion(q);
                    handleAsk(q);
                  }}
                  className="w-full text-left text-xs bg-surface-highlight hover:bg-slate-800 text-slate-300 hover:text-sky-300 p-3 rounded-xl border border-border/80 transition-all flex items-center justify-between group hover:border-sky-500/40"
                >
                  <span>{q}</span>
                  <Sparkles className="w-3.5 h-3.5 text-slate-500 group-hover:text-yellow-400 transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-slate-400">
            <Loader2 className="w-8 h-8 text-sky-400 animate-spin" />
            <p className="text-xs font-medium">Translating natural language to Cypher & traversing graph...</p>
          </div>
        )}

        {/* AI Answer & Generated Cypher Result */}
        {result && !loading && (
          <div className="space-y-4 animate-in fade-in duration-200">
            {/* Confidence & Subgraph Highlights Badge */}
            <div className="flex items-center justify-between bg-surface-highlight px-3 py-2 rounded-xl border border-border text-xs">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">Confidence: <strong>{Math.round(result.confidenceScore * 100)}%</strong></span>
              </div>
              <button
                onClick={() => onApplySubgraphHighlight(result.highlightedNodeIds)}
                className="text-sky-400 hover:text-sky-300 font-medium flex items-center gap-1 text-[11px]"
              >
                <Layers className="w-3.5 h-3.5" />
                Focus Subgraph ({result.resultCount} nodes)
              </button>
            </div>

            {/* Markdown Answer Card */}
            <div className="bg-[#0b111e] p-4 rounded-xl border border-border/80 text-xs text-slate-200 leading-relaxed whitespace-pre-line shadow-inner">
              {result.answer}
            </div>

            {/* Generated Cypher Query Card */}
            <div className="bg-[#060a12] rounded-xl border border-border overflow-hidden">
              <div className="flex items-center justify-between px-3 py-2 bg-surface-highlight border-b border-border text-xs">
                <div className="flex items-center gap-1.5 text-slate-400">
                  <Terminal className="w-3.5 h-3.5 text-sky-400" />
                  <span className="font-mono text-[11px] font-semibold text-slate-300">Generated Cypher Query</span>
                </div>
                <button
                  onClick={handleCopyCypher}
                  className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-surface hover:bg-slate-800 transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'Copied' : 'Copy'}</span>
                </button>
              </div>
              <pre className="p-3 font-mono text-[11px] text-sky-300/90 overflow-x-auto selection:bg-sky-500/30">
                {result.cypherQuery}
              </pre>
            </div>
          </div>
        )}
      </div>

      {/* Input Prompt Footer */}
      <div className="p-4 border-t border-border bg-surface-highlight/30">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleAsk(question);
          }}
          className="flex items-center gap-2 bg-[#0b111e] border border-border focus-within:border-sky-500 rounded-xl p-1.5 transition-all shadow-lg"
        >
          <input
            type="text"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
            placeholder="Ask anything (e.g., What breaks if I change X?)..."
            className="flex-1 bg-transparent px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !question.trim()}
            className="p-2 rounded-lg bg-sky-500 hover:bg-sky-400 disabled:opacity-50 text-white transition-all shadow-md shadow-sky-500/20 cursor-pointer"
          >
            {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          </button>
        </form>
      </div>
    </div>
  );
};
