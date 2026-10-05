'use client';

import React from 'react';
import { ToolCategory } from '@/types';
import { 
  Combine, 
  RefreshCw, 
  ShieldCheck, 
  Sliders, 
  Sparkles, 
  Workflow, 
  Layers
} from 'lucide-react';

interface StudioDockProps {
  activeCategory: ToolCategory | 'all' | 'workflow';
  onSelectCategory: (category: ToolCategory | 'all' | 'workflow') => void;
  toolCount: number;
}

export function StudioDock({ activeCategory, onSelectCategory, toolCount }: StudioDockProps) {
  const tabs: Array<{ id: ToolCategory | 'all' | 'workflow'; label: string; icon: React.ComponentType<{ className?: string }>; count?: number }> = [
    { id: 'all', label: 'All Tools', icon: Layers, count: toolCount },
    { id: 'core', label: 'Core', icon: Combine, count: 7 },
    { id: 'convert', label: 'Convert', icon: RefreshCw, count: 10 },
    { id: 'security', label: 'Security', icon: ShieldCheck, count: 7 },
    { id: 'advanced', label: 'Advanced', icon: Sliders, count: 4 },
    { id: 'ai', label: 'AI Studio', icon: Sparkles, count: 4 },
    { id: 'workflow', label: 'Workflows', icon: Workflow },
  ];

  return (
    <div className="flex items-center justify-center w-full my-6 px-4">
      <div className="flex items-center gap-1.5 p-1.5 rounded-2xl bg-white/75 backdrop-blur-2xl border border-white/90 shadow-xl shadow-slate-200/50 overflow-x-auto max-w-full">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeCategory === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => onSelectCategory(tab.id)}
              className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-medium transition-all duration-200 whitespace-nowrap cursor-pointer select-none ${
                isActive
                  ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white shadow-md shadow-indigo-500/20 font-semibold scale-[1.02]'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/60'
              }`}
            >
              <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-slate-500'}`} />
              <span>{tab.label}</span>
              {tab.count !== undefined && (
                <span
                  className={`text-[10px] px-1.5 py-0.5 rounded-full font-mono ${
                    isActive ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
