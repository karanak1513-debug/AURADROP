'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ToolId, WorkflowStep, WorkflowPreset } from '@/types';
import { WORKFLOW_PRESETS } from '@/lib/pdf/workflow-runner';
import { STUDIO_TOOLS } from '@/lib/pdf/core';
import { 
  Workflow, 
  Play, 
  Plus, 
  Trash2, 
  ArrowRight, 
  Sparkles, 
  Layers, 
  CheckCircle2, 
  Download,
  Send,
  FileCode
} from 'lucide-react';
import { PipelineRunner } from './PipelineRunner';

interface WorkflowBuilderProps {
  onSendToVault?: (file: File) => void;
  onSendToScratchpad?: (text: string) => void;
}

export function WorkflowBuilder({ onSendToVault, onSendToScratchpad }: WorkflowBuilderProps) {
  const [activePreset, setActivePreset] = useState<WorkflowPreset>(WORKFLOW_PRESETS[0]);
  const [steps, setSteps] = useState<WorkflowStep[]>(
    WORKFLOW_PRESETS[0].steps.map((s, idx) => ({
      id: `step-${idx + 1}`,
      toolId: s.toolId,
      label: s.label,
      params: s.params || {},
      status: 'idle',
    }))
  );

  const [inputFiles, setInputFiles] = useState<File[]>([]);
  const [isRunningPipeline, setIsRunningPipeline] = useState(false);

  const handleSelectPreset = (preset: WorkflowPreset) => {
    setActivePreset(preset);
    setSteps(
      preset.steps.map((s, idx) => ({
        id: `step-${Date.now()}-${idx}`,
        toolId: s.toolId,
        label: s.label,
        params: s.params || {},
        status: 'idle',
      }))
    );
  };

  const handleAddStep = (toolId: ToolId) => {
    const toolDef = STUDIO_TOOLS.find(t => t.id === toolId);
    const newStep: WorkflowStep = {
      id: `step-${Date.now()}`,
      toolId,
      label: toolDef?.title || toolId,
      params: {},
      status: 'idle',
    };
    setSteps(prev => [...prev, newStep]);
  };

  const handleRemoveStep = (stepId: string) => {
    setSteps(prev => prev.filter(s => s.id !== stepId));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setInputFiles(Array.from(e.target.files));
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 space-y-8">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-800 tracking-tight flex items-center gap-2">
            <Workflow className="w-5 h-5 text-indigo-600" />
            <span>Visual Automation Engine</span>
            <span className="text-xs px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-600 font-mono font-medium border border-indigo-100">
              Multi-Stage Pipeline
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Chain up to 32 client-side document tools into automated zero-knowledge processing workflows.
          </p>
        </div>

        {/* Action Trigger */}
        <button
          onClick={() => setIsRunningPipeline(true)}
          disabled={steps.length === 0 || inputFiles.length === 0}
          className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-700 hover:to-indigo-800 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-500/25 transition-all cursor-pointer self-start md:self-auto"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          <span>Execute Pipeline ({steps.length} Steps)</span>
        </button>
      </div>

      {/* Preset Selector Bar */}
      <div className="space-y-2">
        <label className="text-xs font-semibold text-slate-600">Featured Workflow Recipes</label>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {WORKFLOW_PRESETS.map(preset => {
            const isSelected = activePreset.id === preset.id;
            return (
              <div
                key={preset.id}
                onClick={() => handleSelectPreset(preset)}
                className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-white border-indigo-500 shadow-md shadow-indigo-500/10 ring-1 ring-indigo-500/20'
                    : 'bg-white/60 border-white/90 hover:bg-white hover:border-slate-200'
                }`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <Sparkles className={`w-4 h-4 ${isSelected ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <h4 className="text-xs font-bold text-slate-800">{preset.name}</h4>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-2 leading-relaxed">
                  {preset.description}
                </p>
                <div className="mt-3 flex items-center gap-1 text-[10px] text-slate-400 font-mono">
                  <span>{preset.steps.length} steps:</span>
                  <span className="text-indigo-600 truncate">
                    {preset.steps.map(s => s.toolId.replace(/-pdf$/, '')).join(' → ')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Pipeline Constructor Stage */}
      <div className="p-6 rounded-3xl bg-white/70 backdrop-blur-3xl border border-white/90 shadow-xl space-y-6">
        {/* Step 0: Input Stage */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl bg-indigo-50/40 border border-indigo-100/60">
          <div>
            <h4 className="text-xs font-bold text-slate-800 flex items-center gap-2">
              <span className="w-5 h-5 rounded-full bg-indigo-600 text-white text-[10px] flex items-center justify-center font-mono">
                0
              </span>
              <span>Pipeline Ingestion Stage</span>
            </h4>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Select one or more input documents to ingest into the pipeline.
            </p>
          </div>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors shadow-sm cursor-pointer shrink-0">
            <span>Choose Input Files ({inputFiles.length})</span>
            <input
              type="file"
              multiple
              onChange={handleFileChange}
              className="hidden"
            />
          </label>
        </div>

        {/* Step Sequence Chain */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-700">Sequential Execution Chain</span>
            <span className="text-[11px] text-slate-400 font-mono">{steps.length} active stages</span>
          </div>

          <div className="space-y-2.5">
            <AnimatePresence>
              {steps.map((step, idx) => (
                <motion.div
                  key={step.id}
                  layout
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-slate-200/80 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-lg bg-slate-100 text-slate-600 font-mono text-xs flex items-center justify-center font-semibold">
                      {idx + 1}
                    </span>
                    <div>
                      <h5 className="text-xs font-bold text-slate-800">{step.label}</h5>
                      <span className="text-[10px] font-mono text-slate-400">{step.toolId}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    {idx < steps.length - 1 && (
                      <ArrowRight className="w-4 h-4 text-slate-300 hidden sm:block" />
                    )}
                    <button
                      onClick={() => handleRemoveStep(step.id)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-rose-500 hover:bg-rose-50 transition-colors cursor-pointer"
                      title="Remove Step"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>

        {/* Add Step Selector */}
        <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-500 flex items-center gap-1.5 mr-2">
            <Plus className="w-3.5 h-3.5 text-indigo-600" />
            <span>Append Tool to Pipeline:</span>
          </span>

          <select
            onChange={e => {
              if (e.target.value) {
                handleAddStep(e.target.value as ToolId);
                e.target.value = '';
              }
            }}
            defaultValue=""
            className="px-3 py-1.5 rounded-xl bg-white border border-slate-200 text-xs text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 cursor-pointer"
          >
            <option value="" disabled>Select tool to append...</option>
            {STUDIO_TOOLS.map(t => (
              <option key={t.id} value={t.id}>{t.title} ({t.category})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Real-time Pipeline Execution Modal */}
      {isRunningPipeline && (
        <PipelineRunner
          steps={steps}
          inputFiles={inputFiles}
          onClose={() => setIsRunningPipeline(false)}
          onSendToVault={onSendToVault}
          onSendToScratchpad={onSendToScratchpad}
        />
      )}
    </div>
  );
}
