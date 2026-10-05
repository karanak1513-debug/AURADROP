'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { StudioToolDefinition, ToolId } from '@/types';
import { 
  Combine, 
  Scissors, 
  Layers, 
  RotateCw, 
  Crop, 
  Hash, 
  Stamp, 
  Image as ImageIcon, 
  FileImage, 
  FileCode, 
  Globe, 
  FileText, 
  FileType, 
  Table, 
  Sheet, 
  Presentation, 
  FileSliders, 
  Lock, 
  Unlock, 
  EyeOff, 
  PenTool, 
  Archive, 
  Wrench, 
  GitCompare, 
  Minimize2, 
  CheckSquare, 
  Camera, 
  ScanText, 
  Sparkles, 
  Languages, 
  FolderArchive,
  Search,
  ArrowRight
} from 'lucide-react';

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Combine,
  Scissors,
  Layers,
  RotateCw,
  Crop,
  Hash,
  Stamp,
  Image: ImageIcon,
  FileImage,
  FileCode,
  Globe,
  FileText,
  FileType,
  Table,
  Sheet,
  Presentation,
  FileSliders,
  Lock,
  Unlock,
  EyeOff,
  PenTool,
  Archive,
  Wrench,
  GitCompare,
  Minimize2,
  CheckSquare,
  Camera,
  ScanText,
  Sparkles,
  Languages,
  FolderArchive,
};

interface ToolCardGridProps {
  tools: StudioToolDefinition[];
  onSelectTool: (toolId: ToolId) => void;
}

export function ToolCardGrid({ tools, onSelectTool }: ToolCardGridProps) {
  const [searchQuery, setSearchQuery] = useState('');

  const filteredTools = tools.filter(tool => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      tool.title.toLowerCase().includes(q) ||
      tool.description.toLowerCase().includes(q) ||
      tool.tags.some(t => t.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-full max-w-7xl mx-auto px-4">
      {/* Search Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <span>In-Browser Document Studio</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-mono font-medium border border-indigo-100">
              32 Tools • 100% Client Sandbox
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Zero-knowledge processing via WebAssembly & Canvas. Files never transmit across any network.
          </p>
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Search 32 tools or features..."
            className="w-full pl-9 pr-4 py-2 rounded-xl bg-white/80 border border-slate-200/80 text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all shadow-sm"
          />
        </div>
      </div>

      {/* Grid of Tool Cards */}
      <motion.div 
        layout
        className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4"
      >
        <AnimatePresence>
          {filteredTools.map((tool, idx) => {
            const Icon = ICON_MAP[tool.iconName] || Layers;
            return (
              <motion.div
                key={tool.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
                onClick={() => onSelectTool(tool.id)}
                whileHover={{ y: -4, scale: 1.015 }}
                whileTap={{ scale: 0.985 }}
                className="group relative p-4 rounded-2xl bg-white/70 backdrop-blur-2xl border border-white/90 shadow-[0_15px_30px_-10px_rgba(0,0,0,0.04)] hover:shadow-[0_20px_40px_-12px_rgba(99,102,241,0.12)] hover:border-indigo-200/80 transition-all duration-300 cursor-pointer flex flex-col justify-between"
              >
                <div>
                  {/* Top Bar with Icon & Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-50 to-cyan-50 border border-indigo-100/60 flex items-center justify-center text-indigo-600 group-hover:from-indigo-600 group-hover:to-cyan-600 group-hover:text-white transition-all duration-300 shadow-sm">
                      <Icon className="w-5 h-5 transition-transform duration-300 group-hover:scale-110" />
                    </div>

                    {tool.badge && (
                      <span className="text-[10px] font-semibold tracking-wide uppercase px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/60 group-hover:bg-indigo-50 group-hover:text-indigo-600 group-hover:border-indigo-100 transition-colors">
                        {tool.badge}
                      </span>
                    )}
                  </div>

                  {/* Title & Description */}
                  <h3 className="text-sm font-semibold text-slate-800 group-hover:text-indigo-600 transition-colors duration-200 mb-1">
                    {tool.title}
                  </h3>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {tool.description}
                  </p>
                </div>

                {/* Footer Tag */}
                <div className="mt-4 pt-3 border-t border-slate-100/80 flex items-center justify-between text-[11px] text-slate-400">
                  <span className="font-mono bg-slate-50 px-2 py-0.5 rounded text-slate-500 text-[10px]">
                    {tool.outputFormat}
                  </span>
                  <div className="flex items-center gap-1 text-indigo-600 font-medium opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </motion.div>

      {filteredTools.length === 0 && (
        <div className="p-12 text-center rounded-2xl bg-white/50 backdrop-blur-xl border border-white/80">
          <p className="text-sm text-slate-500">No tools matched your search query &ldquo;{searchQuery}&rdquo;.</p>
          <button
            onClick={() => setSearchQuery('')}
            className="mt-3 px-4 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 text-xs font-semibold hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            Clear Search
          </button>
        </div>
      )}
    </div>
  );
}
