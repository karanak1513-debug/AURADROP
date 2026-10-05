'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  PenTool,
  Square,
  Circle,
  ArrowRight,
  Diamond,
  Type,
  StickyNote,
  Eraser,
  Download,
  RotateCcw,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Users,
  Palette,
  Sparkles,
  MousePointer,
  Trash2,
} from 'lucide-react';
import { getP2PMesh, PeerMessage } from '@/lib/p2p/mesh';

interface CollaborativeBoardProps {
  roomId: string;
  peerId: string;
  isNuked?: boolean;
}

type ToolType = 'pencil' | 'rectangle' | 'circle' | 'arrow' | 'diamond' | 'text' | 'sticky' | 'eraser';

interface CanvasElement {
  id: string;
  type: ToolType;
  points?: { x: number; y: number }[];
  x: number;
  y: number;
  width?: number;
  height?: number;
  color: string;
  strokeWidth: number;
  text?: string;
  stickyColor?: string;
}

interface PeerCursor {
  peerId: string;
  peerName: string;
  x: number;
  y: number;
  color: string;
}

const COLOR_PALETTE = [
  '#0f172a', // Slate Dark
  '#6366f1', // Electric Indigo
  '#06b6d4', // Opal Cyan
  '#f43f5e', // Coral
  '#10b981', // Emerald
  '#8b5cf6', // Violet
];

const STICKY_PALETTE = [
  { name: 'Yellow', bg: '#fef08a', border: '#fde047' },
  { name: 'Cyan', bg: '#cffafe', border: '#a5f3fc' },
  { name: 'Lavender', bg: '#ede9fe', border: '#ddd6fe' },
  { name: 'Rose', bg: '#ffe4e6', border: '#fecdd3' },
];

export function CollaborativeBoard({ roomId, peerId, isNuked = false }: CollaborativeBoardProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Tools & Styling State
  const [selectedTool, setSelectedTool] = useState<ToolType>('pencil');
  const [selectedColor, setSelectedColor] = useState<string>('#6366f1');
  const [strokeWidth, setStrokeWidth] = useState<number>(3);
  const [stickyColor, setStickyColor] = useState<string>('#fef08a');
  const [zoomLevel, setZoomLevel] = useState<number>(1);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Canvas State & History
  const [elements, setElements] = useState<CanvasElement[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [currentElement, setCurrentElement] = useState<CanvasElement | null>(null);

  // Peer Presence State
  const [peerCursors, setPeerCursors] = useState<Record<string, PeerCursor>>({});

  // Redraw Canvas
  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Apply pan and zoom
    ctx.translate(panOffset.x, panOffset.y);
    ctx.scale(zoomLevel, zoomLevel);

    // Background Grid
    ctx.strokeStyle = 'rgba(226, 232, 240, 0.6)';
    ctx.lineWidth = 1;
    const gridSize = 40;
    const startX = -panOffset.x / zoomLevel;
    const startY = -panOffset.y / zoomLevel;
    const endX = startX + canvas.width / zoomLevel;
    const endY = startY + canvas.height / zoomLevel;

    for (let x = Math.floor(startX / gridSize) * gridSize; x < endX; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
      ctx.stroke();
    }
    for (let y = Math.floor(startY / gridSize) * gridSize; y < endY; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
      ctx.stroke();
    }

    // Render all elements
    const allElements = currentElement ? [...elements, currentElement] : elements;

    allElements.forEach((el) => {
      ctx.strokeStyle = el.color;
      ctx.fillStyle = el.color;
      ctx.lineWidth = el.strokeWidth;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      if (el.type === 'pencil' && el.points && el.points.length > 0) {
        ctx.beginPath();
        ctx.moveTo(el.points[0].x, el.points[0].y);
        for (let i = 1; i < el.points.length; i++) {
          ctx.lineTo(el.points[i].x, el.points[i].y);
        }
        ctx.stroke();
      } else if (el.type === 'rectangle' && el.width && el.height) {
        ctx.beginPath();
        ctx.roundRect(el.x, el.y, el.width, el.height, 6);
        ctx.stroke();
      } else if (el.type === 'circle' && el.width && el.height) {
        ctx.beginPath();
        const rx = Math.abs(el.width / 2);
        const ry = Math.abs(el.height / 2);
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.stroke();
      } else if (el.type === 'diamond' && el.width && el.height) {
        const cx = el.x + el.width / 2;
        const cy = el.y + el.height / 2;
        ctx.beginPath();
        ctx.moveTo(cx, el.y);
        ctx.lineTo(el.x + el.width, cy);
        ctx.lineTo(cx, el.y + el.height);
        ctx.lineTo(el.x, cy);
        ctx.closePath();
        ctx.stroke();
      } else if (el.type === 'arrow' && el.width !== undefined && el.height !== undefined) {
        const fromX = el.x;
        const fromY = el.y;
        const toX = el.x + el.width;
        const toY = el.y + el.height;
        const angle = Math.atan2(toY - fromY, toX - fromX);
        const headLen = 14;

        ctx.beginPath();
        ctx.moveTo(fromX, fromY);
        ctx.lineTo(toX, toY);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(toX, toY);
        ctx.lineTo(toX - headLen * Math.cos(angle - Math.PI / 6), toY - headLen * Math.sin(angle - Math.PI / 6));
        ctx.lineTo(toX - headLen * Math.cos(angle + Math.PI / 6), toY - headLen * Math.sin(angle + Math.PI / 6));
        ctx.closePath();
        ctx.fill();
      } else if (el.type === 'sticky') {
        const w = el.width || 140;
        const h = el.height || 100;
        ctx.fillStyle = el.stickyColor || '#fef08a';
        ctx.shadowColor = 'rgba(0,0,0,0.06)';
        ctx.shadowBlur = 10;
        ctx.fillRect(el.x, el.y, w, h);
        ctx.shadowBlur = 0;
        ctx.strokeStyle = '#fde047';
        ctx.strokeRect(el.x, el.y, w, h);

        ctx.fillStyle = '#1e293b';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText(el.text || 'Sticky Note', el.x + 12, el.y + 24);
      } else if (el.type === 'text') {
        ctx.fillStyle = el.color;
        ctx.font = '14px Geist Mono, monospace';
        ctx.fillText(el.text || 'Label', el.x, el.y);
      }
    });

    ctx.restore();
  }, [elements, currentElement, panOffset, zoomLevel]);

  // Keep Canvas Resized
  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      const canvas = canvasRef.current;
      if (!container || !canvas) return;
      canvas.width = container.clientWidth;
      canvas.height = 540;
      redraw();
    };

    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [redraw]);

  useEffect(() => {
    redraw();
  }, [redraw]);

  // Coordinates Helper
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    const rawX = e.clientX - rect.left;
    const rawY = e.clientY - rect.top;
    return {
      x: (rawX - panOffset.x) / zoomLevel,
      y: (rawY - panOffset.y) / zoomLevel,
    };
  };

  // Broadcast Peer Mouse Position
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);

    // Throttle broadcast
    const mesh = getP2PMesh();
    mesh.broadcast({
      type: 'PEER_CURSOR',
      senderId: peerId,
      senderName: peerId.substring(0, 7),
      payload: { x: coords.x, y: coords.y },
      timestamp: Date.now(),
    });

    if (!isDrawing || !currentElement) return;

    if (currentElement.type === 'pencil') {
      const pts = currentElement.points || [];
      const updated = {
        ...currentElement,
        points: [...pts, coords],
      };
      setCurrentElement(updated);
    } else {
      const updated = {
        ...currentElement,
        width: coords.x - currentElement.x,
        height: coords.y - currentElement.y,
      };
      setCurrentElement(updated);
    }
  };

  const handleMouseDown = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    setIsDrawing(true);

    if (selectedTool === 'eraser') {
      // Find and remove elements near click
      setElements((prev) =>
        prev.filter((el) => {
          const dist = Math.hypot(el.x - coords.x, el.y - coords.y);
          return dist > 25;
        })
      );
      return;
    }

    if (selectedTool === 'text') {
      const input = prompt('Enter text note:');
      if (input) {
        const newEl: CanvasElement = {
          id: `text-${Date.now()}`,
          type: 'text',
          x: coords.x,
          y: coords.y,
          color: selectedColor,
          strokeWidth,
          text: input,
        };
        const updated = [...elements, newEl];
        setElements(updated);
        broadcastStroke(newEl);
      }
      setIsDrawing(false);
      return;
    }

    if (selectedTool === 'sticky') {
      const input = prompt('Enter sticky note content:') || 'Quick Note';
      const newEl: CanvasElement = {
        id: `sticky-${Date.now()}`,
        type: 'sticky',
        x: coords.x,
        y: coords.y,
        width: 140,
        height: 90,
        color: '#1e293b',
        strokeWidth: 1,
        stickyColor,
        text: input,
      };
      const updated = [...elements, newEl];
      setElements(updated);
      broadcastStroke(newEl);
      setIsDrawing(false);
      return;
    }

    const newElement: CanvasElement = {
      id: `el-${Date.now()}`,
      type: selectedTool,
      x: coords.x,
      y: coords.y,
      points: selectedTool === 'pencil' ? [coords] : undefined,
      color: selectedColor,
      strokeWidth,
    };

    setCurrentElement(newElement);
  };

  const broadcastStroke = (element: CanvasElement) => {
    const mesh = getP2PMesh();
    mesh.broadcast({
      type: 'CANVAS_STROKE',
      senderId: peerId,
      senderName: peerId.substring(0, 7),
      payload: element,
      timestamp: Date.now(),
    });
  };

  const handleMouseUp = () => {
    if (!isDrawing || !currentElement) {
      setIsDrawing(false);
      return;
    }

    const updated = [...elements, currentElement];
    setElements(updated);
    broadcastStroke(currentElement);
    setCurrentElement(null);
    setIsDrawing(false);
  };

  // P2P Incoming Canvas Strokes & Cursors
  useEffect(() => {
    const mesh = getP2PMesh();
    const unsub = mesh.onMessage((msg: PeerMessage) => {
      if (msg.type === 'CANVAS_STROKE') {
        const el = msg.payload as CanvasElement;
        if (el && el.id) {
          setElements((prev) => [...prev, el]);
        }
      } else if (msg.type === 'CANVAS_CLEAR') {
        setElements([]);
      } else if (msg.type === 'PEER_CURSOR') {
        const pos = msg.payload as { x: number; y: number };
        setPeerCursors((prev) => ({
          ...prev,
          [msg.senderId]: {
            peerId: msg.senderId,
            peerName: msg.senderName,
            x: pos.x,
            y: pos.y,
            color: '#06b6d4',
          },
        }));
      }
    });

    return () => unsub();
  }, []);

  // Clear Board
  const clearBoard = () => {
    setElements([]);
    const mesh = getP2PMesh();
    mesh.broadcast({
      type: 'CANVAS_CLEAR',
      senderId: peerId,
      senderName: peerId.substring(0, 7),
      payload: {},
      timestamp: Date.now(),
    });
  };

  // Export as PNG
  const exportPNG = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const url = canvas.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `AURA-WHITEBOARD-${roomId}-${Date.now()}.png`;
    a.click();
  };

  // Anti-Forensics Zeroize
  useEffect(() => {
    if (isNuked) {
      setElements([]);
      setCurrentElement(null);
      setPeerCursors({});
      const canvas = canvasRef.current;
      if (canvas) {
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [isNuked]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* Main Whiteboard Container */}
      <div className="bg-white/70 backdrop-blur-3xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.05)] flex flex-col gap-4">
        {/* Header Control Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/80 shadow-xs">
              <PenTool className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Infinite Collaborative Whiteboard
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  EXCALIDRAW STYLE
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Real-time multi-peer vector sketchpad with tactile shapes, sticky notes, and zero-server sync.
              </p>
            </div>
          </div>

          {/* Export & Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={exportPNG}
              className="px-3.5 py-1.5 rounded-xl bg-white border border-slate-200/80 hover:bg-slate-50 text-slate-700 font-mono text-xs font-semibold flex items-center gap-1.5 shadow-xs transition cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-indigo-600" />
              EXPORT PNG
            </button>

            <button
              onClick={clearBoard}
              className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-mono text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
              title="Clear Canvas"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Floating Tool Palette Dock */}
        <div className="flex flex-wrap items-center justify-between gap-4 p-2.5 rounded-2xl bg-slate-50/80 border border-slate-200/80 backdrop-blur-md">
          {/* Drawing Tools */}
          <div className="flex items-center gap-1.5">
            {[
              { id: 'pencil', icon: PenTool, label: 'Freehand' },
              { id: 'rectangle', icon: Square, label: 'Rectangle' },
              { id: 'circle', icon: Circle, label: 'Ellipse' },
              { id: 'diamond', icon: Diamond, label: 'Diamond' },
              { id: 'arrow', icon: ArrowRight, label: 'Arrow' },
              { id: 'text', icon: Type, label: 'Text' },
              { id: 'sticky', icon: StickyNote, label: 'Sticky' },
              { id: 'eraser', icon: Eraser, label: 'Eraser' },
            ].map((tool) => {
              const Icon = tool.icon;
              return (
                <button
                  key={tool.id}
                  onClick={() => setSelectedTool(tool.id as ToolType)}
                  className={`p-2 rounded-xl transition cursor-pointer flex items-center gap-1 ${
                    selectedTool === tool.id
                      ? 'bg-white text-indigo-600 shadow-sm border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800 hover:bg-white/60'
                  }`}
                  title={tool.label}
                >
                  <Icon className="w-4 h-4" />
                </button>
              );
            })}
          </div>

          {/* Color Palettes & Stroke Width */}
          <div className="flex items-center gap-4">
            {/* Color Swatches */}
            <div className="flex items-center gap-1.5">
              {COLOR_PALETTE.map((c) => (
                <button
                  key={c}
                  onClick={() => setSelectedColor(c)}
                  style={{ backgroundColor: c }}
                  className={`w-5 h-5 rounded-full transition cursor-pointer ${
                    selectedColor === c ? 'ring-2 ring-offset-2 ring-indigo-500 scale-110' : 'opacity-80 hover:opacity-100'
                  }`}
                />
              ))}
            </div>

            {/* Stroke Thickness */}
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-slate-200">
              {[2, 4, 6].map((w) => (
                <button
                  key={w}
                  onClick={() => setStrokeWidth(w)}
                  className={`w-6 h-6 rounded-lg text-[10px] font-mono font-bold flex items-center justify-center cursor-pointer ${
                    strokeWidth === w ? 'bg-indigo-600 text-white' : 'text-slate-600'
                  }`}
                >
                  {w}px
                </button>
              ))}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1">
              <button
                onClick={() => setZoomLevel((z) => Math.max(0.5, z - 0.1))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <span className="text-[11px] font-mono text-slate-500 min-w-[36px] text-center">
                {Math.round(zoomLevel * 100)}%
              </span>
              <button
                onClick={() => setZoomLevel((z) => Math.min(2.0, z + 0.1))}
                className="p-1.5 rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-600"
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Canvas Frame */}
        <div
          ref={containerRef}
          className="relative w-full rounded-2xl bg-white border border-slate-200/90 shadow-inner overflow-hidden cursor-crosshair min-h-[540px]"
        >
          <canvas
            ref={canvasRef}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="w-full h-full block"
          />

          {/* Render Peer Mouse Cursors */}
          {Object.values(peerCursors).map((peer) => (
            <div
              key={peer.peerId}
              style={{
                position: 'absolute',
                left: peer.x * zoomLevel + panOffset.x,
                top: peer.y * zoomLevel + panOffset.y,
                pointerEvents: 'none',
                transition: 'all 0.08s ease-out',
              }}
              className="flex items-center gap-1 z-20"
            >
              <MousePointer className="w-4 h-4 text-cyan-500 fill-cyan-400 drop-shadow-sm -rotate-45" />
              <span className="px-1.5 py-0.5 rounded bg-cyan-600 text-white font-mono text-[10px] font-bold shadow-xs whitespace-nowrap">
                {peer.peerName}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
