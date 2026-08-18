'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Header } from '../components/Header';
import { GraphCanvas } from '../components/GraphCanvas';
import { AICopilotDrawer } from '../components/AICopilotDrawer';
import { BlastRadiusSidebar } from '../components/BlastRadiusSidebar';
import { CodeViewerModal } from '../components/CodeViewerModal';
import { IngestModal } from '../components/IngestModal';
import { fetchGraphQL, GET_GRAPH_DATA_QUERY, GET_BLAST_RADIUS_QUERY } from '../lib/graphqlClient';
import { Loader2, AlertCircle } from 'lucide-react';

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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Highlighting & selection state
  const [selectedNode, setSelectedNode] = useState<any | null>(null);
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<string[]>([]);
  const [highlightedEdgeIds, setHighlightedEdgeIds] = useState<string[]>([]);

  // Modals & Panels
  const [isCopilotOpen, setIsCopilotOpen] = useState(false);
  const [blastRadiusReport, setBlastRadiusReport] = useState<any | null>(null);
  const [codeViewerNode, setCodeViewerNode] = useState<any | null>(null);
  const [isIngestOpen, setIsIngestOpen] = useState(false);

  // Load Graph Data from GraphQL API
  const loadGraph = useCallback(async (repoId: string, filter: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchGraphQL(GET_GRAPH_DATA_QUERY, {
        repoId,
        filterType: filter === 'ALL' ? null : filter
      });

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
      console.error('Failed to load graph data:', err);
      setError(err.message || 'Could not connect to GraphQL API Gateway');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadGraph(selectedRepoId, filterType);
  }, [selectedRepoId, filterType, loadGraph]);

  // Handle Blast Radius Trigger
  const handleAnalyzeBlastRadius = async (node: any) => {
    try {
      const data = await fetchGraphQL(GET_BLAST_RADIUS_QUERY, {
        nodeId: node.id,
        repoId: selectedRepoId,
        maxDepth: 3,
        direction: 'UPSTREAM'
      });

      if (data && data.blastRadius) {
        setBlastRadiusReport(data.blastRadius);
        setHighlightedNodeIds(data.blastRadius.highlightedNodeIds || []);
        setHighlightedEdgeIds(data.blastRadius.highlightedEdgeIds || []);
        setSelectedNode(node);
      }
    } catch (err) {
      console.error('Failed to calculate blast radius:', err);
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
    <main className="flex flex-col h-screen w-screen bg-[#070b12] text-slate-100 overflow-hidden">
      {/* Top Header */}
      <Header
        repositories={repositories}
        selectedRepoId={selectedRepoId}
        onSelectRepo={(id) => {
          setSelectedRepoId(id);
          setHighlightedNodeIds([]);
          setHighlightedEdgeIds([]);
          setBlastRadiusReport(null);
        }}
        stats={stats}
        filterType={filterType}
        onFilterChange={setFilterType}
        onOpenIngest={() => setIsIngestOpen(true)}
        onToggleCopilot={() => setIsCopilotOpen(!isCopilotOpen)}
        isCopilotOpen={isCopilotOpen}
      />

      {/* Main Canvas Area */}
      <div className="flex-1 relative w-full h-full">
        {loading && (
          <div className="absolute inset-0 z-20 bg-[#070b12]/80 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
            <Loader2 className="w-9 h-9 text-sky-400 animate-spin" />
            <p className="text-sm font-medium text-slate-300">Loading codebase AST & call graph...</p>
          </div>
        )}

        {error && (
          <div className="absolute top-8 left-1/2 -translate-x-1/2 z-30 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-4 py-2.5 rounded-xl flex items-center gap-2 text-xs shadow-xl">
            <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{error} — ensure API Gateway is running on port 4000.</span>
          </div>
        )}

        {/* 2D Interactive Force Canvas */}
        <GraphCanvas
          nodes={nodes}
          edges={edges}
          highlightedNodeIds={highlightedNodeIds}
          highlightedEdgeIds={highlightedEdgeIds}
          onSelectNode={handleSelectNode}
          onAnalyzeBlastRadius={handleAnalyzeBlastRadius}
          selectedNodeId={selectedNode?.id}
        />

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
        <AICopilotDrawer
          isOpen={isCopilotOpen}
          onClose={() => setIsCopilotOpen(false)}
          repoId={selectedRepoId}
          onApplySubgraphHighlight={handleApplySubgraphHighlight}
        />

        {/* AST Code Viewer Modal */}
        <CodeViewerModal
          node={codeViewerNode}
          onClose={() => setCodeViewerNode(null)}
          onAnalyzeBlastRadius={handleAnalyzeBlastRadius}
        />

        {/* Ingest Repository Modal */}
        <IngestModal
          isOpen={isIngestOpen}
          onClose={() => setIsIngestOpen(false)}
          onIngestSuccess={() => loadGraph(selectedRepoId, filterType)}
        />
      </div>
    </main>
  );
}
