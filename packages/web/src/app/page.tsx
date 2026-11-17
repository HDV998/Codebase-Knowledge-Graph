'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Header } from '../components/Header';
import dynamic from 'next/dynamic';
import { BlastRadiusSidebar } from '../components/BlastRadiusSidebar';
import { fetchGraphQL, GET_GRAPH_DATA_QUERY, GET_BLAST_RADIUS_QUERY } from '../lib/graphqlClient';
import { Loader2, AlertCircle } from 'lucide-react';

const GraphCanvas = dynamic(() => import('../components/GraphCanvas').then(module => module.GraphCanvas), { ssr: false });
const AICopilotDrawer = dynamic(() => import('../components/AICopilotDrawer').then(module => module.AICopilotDrawer), { ssr: false });
const CodeViewerModal = dynamic(() => import('../components/CodeViewerModal').then(module => module.CodeViewerModal), { ssr: false });
const IngestModal = dynamic(() => import('../components/IngestModal').then(module => module.IngestModal), { ssr: false });

export default function Home() {
  const [repositories, setRepositories] = useState<any[]>([
    { id: 'ecommerce-payment-platform', name: 'E-Commerce & Payment Platform', branch: 'main' },
    { id: 'auth-identity-rbac-service', name: 'Auth & Identity RBAC Service', branch: 'main' }
  ]);
  const [selectedRepoId, setSelectedRepoId] = useState('ecommerce-payment-platform');
  const [filterType, setFilterType] = useState('ALL');
  const [nodes, setNodes] = useState<any[]>([]);
  const [edges, setEdges] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(undefined);
  const [itemId, setItemId] = useState('');
  const [reload, setReload] = useState(0);
  const analysisRequest = useRef<AbortController | null>(null);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Highlighting & selection state
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([]);

  // Modals & Panels
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [hasOpenedCopilot, setHasOpenedCopilot] = useState(false);
  const [blastRadiusReport, setBlastRadiusReport] = useState<any | null>(null);
  const [codeViewerNode, setCodeViewerNode] = useState<any | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // Load Graph Data from GraphQL API
  useEffect(() => {
    const controller = new AbortController();
    const { signal } = controller;
    async function loadGraph() {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphQL(GET_GRAPH_DATA_QUERY, {
        repoId: selectedRepoId,
        filterType: filterType === 'ALL' ? null : filterType,
        limit: 300
      }, signal);
      if (signal.aborted) return;

      if (data) {
        if (data.repositories && data.repositories.length > 0) {
          setRepositories(data.repositories);
        }
        if (data.graphData) {
          setNodes(data.graphData.nodes || []);
          setEdges(data.graphData.edges || []);
        }
        if (data.stats) {
          setStats(data.stats);
        }
      }
    } catch (err: any) {
      if (signal.aborted) return;
      setError(err.message || 'Could not connect to GraphQL API Gateway');
    } finally {
      if (!signal.aborted) setLoading(false);
    }
    }
    void loadGraph();
    return () => {
      controller.abort();
      analysisRequest.current?.abort();
    };
  }, [selectedRepoId, filterType, reload]);

  // Handle Blast Radius Trigger
  const handleAnalyzeBlastRadius = async (node: any) => {
    analysisRequest.current?.abort();
    const controller = new AbortController();
    analysisRequest.current = controller;
    setAnalysisError(null);
    try {
      const data = await fetchGraphQL(GET_BLAST_RADIUS_QUERY, {
        nodeId: node.id,
        repoId: selectedRepoId,
        maxDepth: 3,
        direction: 'UPSTREAM'
      }, controller.signal);
      if (controller.signal.aborted) return;

      if (data && data.blastRadius) {
        setBlastRadiusReport(data.blastRadius);
        setHighlightedNodeIds(data.blastRadius.highlightedNodeIds || []);
        setHighlightedEdgeIds(data.blastRadius.highlightedEdgeIds || []);
        setSelectedNode(node);
      }
    } catch (err) {
      if (!controller.signal.aborted) setAnalysisError('Could not calculate change impact. Select the node again to retry.');
    }
  };

  // Node selection from canvas
  const handleSelectNode = (node: any) => {
    setSelectedNode(node);
    handleAnalyzeBlastRadius(node);
  };

  const handleApplySubgraphHighlight = (nodeIds: string[]) => {
    setHighlightedNodeIds(nodeIds);
  };

  return (
    <main className="flex flex-col h-[100dvh] w-full bg-[#0b1020] text-slate-100 overflow-hidden">
      {/* Top Header */}
      <Header
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onSelectRepo={(id) => {
          setSelectedRepoId(id);
          setItemId('');
          setSelectedNode(null);
          setCodeViewerNode(null);
          setAnalysisError(null);
          setHighlightedNodeIds([]);
          setHighlightedEdgeIds([]);
          setBlastRadiusReport(null);
        }}
        stats={stats}
        filterType={filterType}
        onFilterChange={(value) => { setFilterType(value); setItemId(''); setAnalysisError(null); }}
        onOpenIngest={() => setIsIngestOpen(true)}
        onToggleCopilot={() => {
          setHasOpenedCopilot(true);
          setIsCopilotOpen(value => !value);
        }}
        isCopilotOpen={isCopilotOpen}
      />

      <div className="graph-toolbar">
        <label htmlFor="graph-item">Inspect an entity</label>
        <select id="graph-item" value={itemId} disabled={loading || !!error || !nodes.length} onChange={(event) => {
          const id = event.target.value;
          setItemId(id);
          const node = nodes.find(entry => entry.id === id);
          if (node) handleSelectNode(node);
        }}>
          <option value="" disabled>Choose a visible node</option>
          {nodes.map(node => <option key={node.id} value={node.id}>{node.name} · {node.type}</option>)}
        </select>
        {!loading && !error && <span>{nodes.length}{nodes.length === 300 && ' (display limit)'} visible nodes</span>}
      </div>
      {analysisError && <p className="graph-toolbar text-rose-300" role="alert">{analysisError}</p>}
      {/* Main Canvas Area */}
      <div className="flex-1 relative w-full min-h-0">
        {loading && (
          <div role="status" className="absolute inset-0 z-20 bg-[#070b12]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 text-sky-400 animate-spin" />
            <p className="text-sm font-medium text-slate-300">Loading codebase AST & call graph...</p>
          </div>
        )}

        {error && (
          <div role="alert" className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shadow-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error}</span>
            <button className="underline" onClick={() => setReload(value => value + 1)}>Retry</button>
          </div>
        )}

        {/* 2D Interactive Force Canvas */}
        {!error && !loading && <GraphCanvas
          nodes={nodes}
          edges={edges}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          onSelectNode={handleSelectNode}
          onAnalyzeBlastRadius={handleAnalyzeBlastRadius}
          selectedNodeId={selectedNode?.id}
        />}

        {/* Left Blast Radius Inspector Sidebar */}
        <BlastRadiusSidebar
          report={blastRadiusReport}
          onClose={() => {
            setBlastRadiusReport(null);
            setHighlightedNodeIds([]);
            setHighlightedEdgeIds([]);
          }}
          onViewCode={(node) => setCodeViewerNode(node)}
          onFocusSubgraph={(nodeIds) => setHighlightedNodeIds(nodeIds)}
        />

        {/* Right AI Copilot Drawer */}
        {hasOpenedCopilot && <AICopilotDrawer
          key={selectedRepoId}
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          repoId={selectedRepoId}
          onApplySubgraphHighlight={handleApplySubgraphHighlight}
        />}

        {/* AST Code Viewer Modal */}
        {codeViewerNode && <CodeViewerModal
          node={codeViewerNode}
          onClose={() => setCodeViewerNode(null)}
          onAnalyzeBlastRadius={handleAnalyzeBlastRadius}
        />}

        {/* Ingest Repository Modal */}
        {isIngestOpen && <IngestModal
          isOpen={isIngestOpen}
          onClose={() => setIsIngestOpen(false)}
          onIngestSuccess={(id: string) => {
            setRepositories(items => items.some(item => item.id === id) ? items : [...items, { id, name: id, branch: 'main' }]);
            setSelectedRepoId(id);
            setFilterType('ALL');
            setItemId('');
            setSelectedNode(null);
            setBlastRadiusReport(null);
            setHighlightedNodeIds([]);
            setHighlightedEdgeIds([]);
            setAnalysisError(null);
            setReload(value => value + 1);
          }}
        />}
      </div>
    </main>
  );
}
