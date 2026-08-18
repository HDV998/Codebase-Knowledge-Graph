'use client';

import React, { useRef, useEffect, useState, useCallback } from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Play, Pause, Compass, ShieldAlert, Sparkles, Filter } from 'lucide-react';

interface Node {
  id: string;
  name: string;
  type: string;
  repoId: string;
  filePath?: string;
  signature?: string;
  startLine?: number;
  endLine?: number;
  cyclomaticComplexity?: number;
  blastRadiusWeight?: number;
  isAsync?: boolean;
  codeSnippet?: string;
  testFramework?: string;
  x?: number;
  y?: number;
  vx?: number;
  vy?: number;
  radius?: number;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  line?: number;
}

interface GraphCanvasProps {
  nodes: Node[];
  edges: Edge[];
  highlightedNodeIds: string[];
  highlightedEdgeIds?: string[];
  onSelectNode: (node: Node) => void;
  onAnalyzeBlastRadius: (node: Node) => void;
  selectedNodeId?: string;
}

export const GraphCanvas: React.FC<GraphCanvasProps> = ({
  nodes: rawNodes,
  edges: rawEdges,
  highlightedNodeIds,
  highlightedEdgeIds = [],
  onSelectNode,
  onAnalyzeBlastRadius,
  selectedNodeId,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Simulation state
  const nodesRef = useRef<(Node & { x: number; y: number; vx: number; vy: number; radius: number })[]>([]);
  const alphaRef = useRef<number>(1.0); // Temperature / energy for cooling decay
  const [hoveredNode, setHoveredNode] = useState<Node | null>(null);
  const [isPhysicsRunning, setIsPhysicsRunning] = useState(true);

  // Camera transform: pan and zoom
  const cameraRef = useRef({ x: 0, y: 0, scale: 0.85 });
  const isDraggingCanvas = useRef(false);
  const draggedNodeIndex = useRef<number | null>(null);
  const lastMousePos = useRef({ x: 0, y: 0 });
  const animationFrameId = useRef<number | null>(null);
  const particleOffsetRef = useRef<number>(0);

  // Node Color & Shape Tokens
  const getNodeColor = (type: string, isHighlighted: boolean, isDimmed: boolean) => {
    if (isDimmed) return 'rgba(75, 85, 99, 0.25)';
    switch (type) {
      case 'Function':
        return '#fbbf24'; // Amber
      case 'Class':
      case 'Interface':
        return '#c084fc'; // Purple
      case 'File':
        return '#38bdf8'; // Sky Blue
      case 'Test':
        return '#34d399'; // Emerald
      default:
        return '#94a3b8';
    }
  };

  // Initialize node layout positions with clean hierarchical file-centric clustering
  useEffect(() => {
    if (!rawNodes || rawNodes.length === 0) {
      nodesRef.current = [];
      return;
    }

    const width = containerRef.current?.clientWidth || 1200;
    const height = containerRef.current?.clientHeight || 800;
    const centerX = width / 2;
    const centerY = height / 2;

    // 1. Separate file nodes and child nodes
    const fileNodes = rawNodes.filter(n => n.type === 'File');
    const nonFileNodes = rawNodes.filter(n => n.type !== 'File');

    // Place File nodes in a spacious outer orbit
    const filePositions = new Map<string, { x: number; y: number }>();
    const fileOrbitRadius = Math.max(340, fileNodes.length * 45);

    fileNodes.forEach((f, idx) => {
      const angle = (idx / Math.max(fileNodes.length, 1)) * 2 * Math.PI - Math.PI / 2;
      const x = centerX + Math.cos(angle) * fileOrbitRadius;
      const y = centerY + Math.sin(angle) * fileOrbitRadius;
      filePositions.set(f.filePath || f.name, { x, y });
    });

    // Place child functions/classes orbiting near their respective files
    const fileChildCount = new Map<string, number>();

    const initialized = rawNodes.map((n) => {
      let x = centerX;
      let y = centerY;
      let radius = 16;

      if (n.type === 'File') {
        const pos = filePositions.get(n.filePath || n.name) || { x: centerX, y: centerY };
        x = pos.x;
        y = pos.y;
        radius = 24;
      } else {
        const parentPos = filePositions.get(n.filePath || '') || { x: centerX, y: centerY };
        const count = fileChildCount.get(n.filePath || '') || 0;
        fileChildCount.set(n.filePath || '', count + 1);

        const childAngle = (count * 1.1) + (Math.random() * 0.4);
        const childDist = 80 + (count % 3) * 35;
        x = parentPos.x + Math.cos(childAngle) * childDist;
        y = parentPos.y + Math.sin(childAngle) * childDist;

        if (n.type === 'Class') radius = 22;
        else if (n.type === 'Test') radius = 20;
        else radius = Math.min(26, 14 + (n.blastRadiusWeight || 1) * 1.4);
      }

      return {
        ...n,
        x,
        y,
        vx: 0,
        vy: 0,
        radius
      };
    });

    nodesRef.current = initialized;
    alphaRef.current = 1.0; // Reset simulation energy on data change
  }, [rawNodes]);

  // Main Canvas Rendering & Physics Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let isSubscribed = true;

    const render = () => {
      if (!isSubscribed) return;

      const width = canvas.width;
      const height = canvas.height;
      const nodes = nodesRef.current;
      const edges = rawEdges;
      const hasHighlights = highlightedNodeIds.length > 0;

      // 1. Run Force Simulation Step with Alpha Annealing (Gradual cooling to zero motion)
      if (isPhysicsRunning && nodes.length > 0 && (alphaRef.current > 0.002 || draggedNodeIndex.current !== null)) {
        const alpha = alphaRef.current;
        const k = 140; // optimal spring distance
        const repulsion = 1800 * alpha;
        const centerGravity = 0.003 * alpha;
        const centerX = width / 2;
        const centerY = height / 2;

        // Node-to-node repulsion
        for (let i = 0; i < nodes.length; i++) {
          for (let j = i + 1; j < nodes.length; j++) {
            const dx = nodes[j].x - nodes[i].x;
            const dy = nodes[j].y - nodes[i].y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const minDist = nodes[i].radius + nodes[j].radius + 35;

            // Strong collision repulsion if overlapping
            if (dist < minDist) {
              const overlapForce = ((minDist - dist) / dist) * 0.45;
              nodes[i].vx -= dx * overlapForce;
              nodes[i].vy -= dy * overlapForce;
              nodes[j].vx += dx * overlapForce;
              nodes[j].vy += dy * overlapForce;
            } else if (dist < 320) {
              const force = (repulsion / (dist * dist));
              const fx = (dx / dist) * force;
              const fy = (dy / dist) * force;
              nodes[i].vx -= fx;
              nodes[i].vy -= fy;
              nodes[j].vx += fx;
              nodes[j].vy += fy;
            }
          }
        }

        // Edge attraction (springs)
        const nodeMap = new Map(nodes.map(n => [n.id, n]));
        for (const edge of edges) {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (src && tgt) {
            const dx = tgt.x - src.x;
            const dy = tgt.y - src.y;
            const dist = Math.sqrt(dx * dx + dy * dy) || 1;
            const springDist = edge.type === 'DEFINES' ? 90 : (edge.type === 'CALLS' ? 150 : 180);
            const springForce = (dist - springDist) * 0.02 * alpha;
            const fx = (dx / dist) * springForce;
            const fy = (dy / dist) * springForce;
            src.vx += fx;
            src.vy += fy;
            tgt.vx -= fx;
            tgt.vy -= fy;
          }
        }

        // Apply velocity with strong damping (friction) and gentle center gravity
        for (let i = 0; i < nodes.length; i++) {
          if (draggedNodeIndex.current === i) continue;
          const node = nodes[i];
          node.vx += (centerX - node.x) * centerGravity;
          node.vy += (centerY - node.y) * centerGravity;
          node.vx *= 0.72; // Strong damping friction
          node.vy *= 0.72;
          node.x += node.vx;
          node.y += node.vy;
        }

        // Cool down the simulation alpha over time
        alphaRef.current *= 0.985;
      }

      particleOffsetRef.current = (particleOffsetRef.current + 0.015) % 1;

      // 2. Clear canvas & apply Camera Transform
      ctx.clearRect(0, 0, width, height);

      // Draw background grid
      ctx.save();
      ctx.strokeStyle = 'rgba(35, 47, 72, 0.35)';
      ctx.lineWidth = 1;
      const gridSize = 40 * cameraRef.current.scale;
      const offsetX = cameraRef.current.x % gridSize;
      const offsetY = cameraRef.current.y % gridSize;

      ctx.beginPath();
      for (let x = offsetX; x < width; x += gridSize) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = offsetY; y < height; y += gridSize) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
      ctx.restore();

      ctx.save();
      ctx.translate(cameraRef.current.x, cameraRef.current.y);
      ctx.scale(cameraRef.current.scale, cameraRef.current.scale);

      const nodeMap = new Map(nodes.map(n => [n.id, n]));

      // 3. Draw Edges
      for (const edge of edges) {
        const src = nodeMap.get(edge.source);
        const tgt = nodeMap.get(edge.target);
        if (!src || !tgt) continue;

        const isSrcHighlighted = highlightedNodeIds.includes(src.id);
        const isTgtHighlighted = highlightedNodeIds.includes(tgt.id);
        const isEdgeHighlighted = highlightedEdgeIds.includes(edge.id) || (isSrcHighlighted && isTgtHighlighted);
        const isDimmed = hasHighlights && !isEdgeHighlighted;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.lineTo(tgt.x, tgt.y);

        if (isEdgeHighlighted) {
          ctx.strokeStyle = '#38bdf8';
          ctx.lineWidth = 3.0;
          ctx.setLineDash([]);
        } else if (isDimmed) {
          ctx.strokeStyle = 'rgba(51, 65, 85, 0.2)';
          ctx.lineWidth = 1.0;
          ctx.setLineDash([]);
        } else if (edge.type === 'CALLS') {
          ctx.strokeStyle = 'rgba(251, 191, 36, 0.6)';
          ctx.lineWidth = 1.8;
          ctx.setLineDash([]);
        } else if (edge.type === 'IMPORTS') {
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.5)';
          ctx.lineWidth = 1.4;
          ctx.setLineDash([4, 4]);
        } else if (edge.type === 'TESTS') {
          ctx.strokeStyle = 'rgba(52, 211, 153, 0.6)';
          ctx.lineWidth = 1.6;
          ctx.setLineDash([6, 3]);
        } else {
          ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
          ctx.lineWidth = 1.2;
          ctx.setLineDash([]);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw directed arrowhead on CALLS / IMPORTS
        if (!isDimmed && (edge.type === 'CALLS' || edge.type === 'IMPORTS')) {
          const angle = Math.atan2(tgt.y - src.y, tgt.x - src.x);
          const arrowDist = tgt.radius + 6;
          const arrowX = tgt.x - Math.cos(angle) * arrowDist;
          const arrowY = tgt.y - Math.sin(angle) * arrowDist;

          ctx.save();
          ctx.fillStyle = isEdgeHighlighted ? '#38bdf8' : (edge.type === 'CALLS' ? '#fbbf24' : '#38bdf8');
          ctx.beginPath();
          ctx.moveTo(arrowX, arrowY);
          ctx.lineTo(arrowX - 10 * Math.cos(angle - Math.PI / 7), arrowY - 10 * Math.sin(angle - Math.PI / 7));
          ctx.lineTo(arrowX - 10 * Math.cos(angle + Math.PI / 7), arrowY - 10 * Math.sin(angle + Math.PI / 7));
          ctx.closePath();
          ctx.fill();
          ctx.restore();
        }

        // Draw animated energy particle for CALLS
        if (!isDimmed && edge.type === 'CALLS') {
          const px = src.x + (tgt.x - src.x) * particleOffsetRef.current;
          const py = src.y + (tgt.y - src.y) * particleOffsetRef.current;
          ctx.beginPath();
          ctx.arc(px, py, 3, 0, Math.PI * 2);
          ctx.fillStyle = '#fde68a';
          ctx.fill();
        }
      }

      // 4. Draw Nodes
      for (const node of nodes) {
        const isHighlighted = highlightedNodeIds.includes(node.id);
        const isSelected = selectedNodeId === node.id;
        const isHovered = hoveredNode?.id === node.id;
        const isDimmed = hasHighlights && !isHighlighted;
        const color = getNodeColor(node.type, isHighlighted, isDimmed);

        ctx.save();

        // Glow ring if selected or highlighted
        if (isSelected || isHighlighted) {
          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 8, 0, Math.PI * 2);
          ctx.fillStyle = isSelected ? 'rgba(56, 189, 248, 0.25)' : 'rgba(251, 191, 36, 0.25)';
          ctx.fill();

          ctx.beginPath();
          ctx.arc(node.x, node.y, node.radius + 4, 0, Math.PI * 2);
          ctx.strokeStyle = isSelected ? '#38bdf8' : '#fbbf24';
          ctx.lineWidth = 2.5;
          ctx.stroke();
        }

        // Node Body
        ctx.beginPath();
        ctx.arc(node.x, node.y, node.radius, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.strokeStyle = isDimmed ? 'rgba(30, 41, 59, 0.5)' : '#0f172a';
        ctx.lineWidth = 2.5;
        ctx.stroke();

        // Type Glyph Icon in Node Center
        ctx.fillStyle = isDimmed ? 'rgba(148, 163, 184, 0.3)' : '#090d16';
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        let glyph = 'ƒ';
        if (node.type === 'Class') glyph = 'C';
        if (node.type === 'File') glyph = '📄';
        if (node.type === 'Test') glyph = '🧪';
        ctx.fillText(glyph, node.x, node.y + (glyph === '📄' || glyph === '🧪' ? 0 : 1));

        // Node Label
        if (!isDimmed || isHovered) {
          ctx.font = isSelected || isHighlighted ? 'bold 12px Inter, sans-serif' : '11px Inter, sans-serif';
          ctx.fillStyle = isHighlighted ? '#ffffff' : (isDimmed ? 'rgba(148, 163, 184, 0.5)' : '#cbd5e1');
          ctx.textAlign = 'center';
          ctx.fillText(node.name, node.x, node.y + node.radius + 14);

          // Subtle type badge below label
          if (cameraRef.current.scale > 0.8) {
            ctx.font = '9px monospace';
            ctx.fillStyle = isDimmed ? 'rgba(100, 116, 139, 0.4)' : 'rgba(148, 163, 184, 0.7)';
            ctx.fillText(node.type.toUpperCase(), node.x, node.y + node.radius + 26);
          }
        }

        ctx.restore();
      }

      ctx.restore();

      animationFrameId.current = requestAnimationFrame(render);
    };

    render();

    return () => {
      isSubscribed = false;
      if (animationFrameId.current) {
        cancelAnimationFrame(animationFrameId.current);
      }
    };
  }, [rawEdges, highlightedNodeIds, highlightedEdgeIds, selectedNodeId, hoveredNode, isPhysicsRunning]);

  // Handle Resize
  useEffect(() => {
    const handleResize = () => {
      if (!canvasRef.current || !containerRef.current) return;
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Convert Screen coords to World coords
  const screenToWorld = (screenX: number, screenY: number) => {
    return {
      x: (screenX - cameraRef.current.x) / cameraRef.current.scale,
      y: (screenY - cameraRef.current.y) / cameraRef.current.scale,
    };
  };

  // Mouse Interactions: Pan, Zoom, Drag Node, Click Node
  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    // Check if clicked a node
    const clickedIdx = nodesRef.current.findIndex(n => {
      const dx = n.x - worldPos.x;
      const dy = n.y - worldPos.y;
      return Math.sqrt(dx * dx + dy * dy) <= n.radius;
    });

    if (clickedIdx !== -1) {
      draggedNodeIndex.current = clickedIdx;
      onSelectNode(nodesRef.current[clickedIdx]);
    } else {
      isDraggingCanvas.current = true;
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;
    const worldPos = screenToWorld(mouseX, mouseY);

    if (draggedNodeIndex.current !== null) {
      const node = nodesRef.current[draggedNodeIndex.current];
      node.x = worldPos.x;
      node.y = worldPos.y;
      node.vx = 0;
      node.vy = 0;
      alphaRef.current = Math.max(alphaRef.current, 0.2); // Gentle live spring response
    } else if (isDraggingCanvas.current) {
      const dx = e.clientX - lastMousePos.current.x;
      const dy = e.clientY - lastMousePos.current.y;
      cameraRef.current.x += dx;
      cameraRef.current.y += dy;
    } else {
      // Hover detection
      const hoverNode = nodesRef.current.find(n => {
        const dx = n.x - worldPos.x;
        const dy = n.y - worldPos.y;
        return Math.sqrt(dx * dx + dy * dy) <= n.radius;
      });
      setHoveredNode(hoverNode || null);
    }
    lastMousePos.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = () => {
    draggedNodeIndex.current = null;
    isDraggingCanvas.current = false;
  };

  const handleWheel = (e: React.WheelEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    const zoomFactor = e.deltaY < 0 ? 1.12 : 0.89;
    const newScale = Math.min(Math.max(cameraRef.current.scale * zoomFactor, 0.2), 3.5);

    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    cameraRef.current.x = mouseX - (mouseX - cameraRef.current.x) * (newScale / cameraRef.current.scale);
    cameraRef.current.y = mouseY - (mouseY - cameraRef.current.y) * (newScale / cameraRef.current.scale);
    cameraRef.current.scale = newScale;
  };

  const handleResetCamera = () => {
    cameraRef.current = { x: 0, y: 0, scale: 1 };
  };

  return (
    <div ref={containerRef} className="relative w-full h-full bg-[#070b12] overflow-hidden select-none">
      <canvas
        ref={canvasRef}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        className="w-full h-full cursor-grab active:cursor-grabbing block"
      />

      {/* Floating Canvas Controls */}
      <div className="absolute bottom-5 left-5 flex items-center gap-2 bg-surface/90 backdrop-blur-md p-1.5 rounded-xl border border-border shadow-xl z-20">
        <button
          onClick={() => {
            cameraRef.current.scale = Math.min(cameraRef.current.scale * 1.25, 3.5);
          }}
          title="Zoom In"
          className="p-2 rounded-lg hover:bg-surface-highlight text-slate-300 hover:text-white transition-colors"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => {
            cameraRef.current.scale = Math.max(cameraRef.current.scale * 0.8, 0.2);
          }}
          title="Zoom Out"
          className="p-2 rounded-lg hover:bg-surface-highlight text-slate-300 hover:text-white transition-colors"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleResetCamera}
          title="Reset Camera View"
          className="p-2 rounded-lg hover:bg-surface-highlight text-slate-300 hover:text-white transition-colors"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <div className="h-4 w-px bg-border my-auto" />
        <button
          onClick={() => setIsPhysicsRunning(!isPhysicsRunning)}
          title={isPhysicsRunning ? "Pause Layout Physics" : "Resume Layout Physics"}
          className={`p-2 rounded-lg transition-colors ${
            isPhysicsRunning ? 'text-sky-400 hover:bg-sky-500/10' : 'text-slate-400 hover:bg-surface-highlight'
          }`}
        >
          {isPhysicsRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </button>
      </div>

      {/* Color Legend Badge */}
      <div className="absolute top-5 left-5 hidden sm:flex items-center gap-4 bg-surface/80 backdrop-blur-md px-3.5 py-2 rounded-xl border border-border text-[11px] text-slate-300 shadow-lg z-20">
        <span className="font-semibold text-slate-400 uppercase tracking-wider text-[10px]">Legend:</span>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 shadow-sm shadow-amber-400/50" />
          <span>Function</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-purple-400 shadow-sm shadow-purple-400/50" />
          <span>Class</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-sky-400 shadow-sm shadow-sky-400/50" />
          <span>File</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 shadow-sm shadow-emerald-400/50" />
          <span>Test</span>
        </div>
      </div>

      {/* Hover Card Tooltip */}
      {hoveredNode && (
        <div 
          className="absolute top-5 right-5 pointer-events-none bg-surface/95 backdrop-blur-md p-4 rounded-xl border border-border shadow-2xl max-w-xs z-30 animate-in fade-in duration-150"
        >
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="font-bold text-sm text-white truncate">{hoveredNode.name}</span>
            <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded-md bg-surface-highlight text-sky-400 border border-sky-400/20">
              {hoveredNode.type}
            </span>
          </div>
          {hoveredNode.filePath && (
            <p className="text-xs text-slate-400 font-mono truncate mb-2">
              📂 {hoveredNode.filePath}
            </p>
          )}
          {hoveredNode.signature && (
            <p className="text-xs text-amber-300 font-mono bg-slate-900/80 p-2 rounded-lg border border-slate-800 break-all mb-2">
              {hoveredNode.signature}
            </p>
          )}
          <div className="grid grid-cols-2 gap-2 text-xs text-slate-300">
            {hoveredNode.cyclomaticComplexity !== undefined && (
              <div className="bg-surface-highlight p-1.5 rounded-md border border-border">
                <span className="text-slate-400 block text-[10px]">Complexity</span>
                <span className="font-semibold text-slate-200">{hoveredNode.cyclomaticComplexity}</span>
              </div>
            )}
            {hoveredNode.blastRadiusWeight !== undefined && (
              <div className="bg-surface-highlight p-1.5 rounded-md border border-border">
                <span className="text-slate-400 block text-[10px]">Criticality Score</span>
                <span className="font-semibold text-amber-400">{hoveredNode.blastRadiusWeight}</span>
              </div>
            )}
          </div>
          <p className="text-[10px] text-slate-500 mt-2 text-center">Click node to inspect blast radius & code</p>
        </div>
      )}
    </div>
  );
};
