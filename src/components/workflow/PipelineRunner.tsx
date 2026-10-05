'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { WorkflowStep, ToolExecutionResult } from '@/types';
import { runWorkflowPipeline } from '@/lib/pdf/workflow-runner';
import { downloadBlob, formatFileSize } from '@/lib/pdf/core';
import { 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Download, 
  Send, 
  FileCode, 
  Sparkles,
  ArrowRight
} from 'lucide-react';

interface PipelineRunnerProps {
  steps: WorkflowStep[];
  inputFiles: File[];
  onClose: () => void;
  onSendToVault?: (file: File) => void;
  onSendToScratchpad?: (text: string) => void;
}

export function PipelineRunner({
  steps: initialSteps,
  inputFiles,
  onClose,
  onSendToVault,
  onSendToScratchpad,
}: PipelineRunnerProps) {
  const [steps, setSteps] = useState<WorkflowStep[]>(initialSteps);
  const [isRunning, setIsRunning] = useState(true);
  const [finalResult, setFinalResult] = useState<ToolExecutionResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    let isCancelled = false;

    const execute = async () => {
      try {
        const result = await runWorkflowPipeline(
          steps,
          inputFiles,
          (stepIndex, updated) => {
            if (isCancelled) return;
            setSteps(prev => {
              const copy = [...prev];
              copy[stepIndex] = { ...copy[stepIndex], ...updated };
              return copy;
            });
          }
        );

        if (!isCancelled) {
          setFinalResult(result);
          setIsRunning(false);
        }
      } catch (err: any) {
        if (!isCancelled) {
          setErrorMessage(err?.message || 'Pipeline failed during step execution');
          setIsRunning(false);
        }
      }
    };

    execute();

    return () => {
      isCancelled = true;
    };
  }, []);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-xl bg-white/95 backdrop-blur-3xl rounded-3xl border border-white/90 shadow-2xl p-6 space-y-6"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-800">Pipeline Execution Engine</h3>
              <p className="text-xs text-slate-500">Executing client-side automated document chain</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step-by-step Execution Visualizer */}
        <div className="space-y-3">
          {steps.map((step, idx) => {
            const isCurrent = step.status === 'running';
            const isDone = step.status === 'completed';
            const isFailed = step.status === 'error';

            return (
              <div
                key={step.id}
                className={`p-3.5 rounded-2xl border transition-all flex items-center justify-between ${
                  isCurrent
                    ? 'bg-indigo-50/60 border-indigo-200 ring-2 ring-indigo-500/20 shadow-sm'
                    : isDone
                    ? 'bg-emerald-50/40 border-emerald-100'
                    : isFailed
                    ? 'bg-rose-50/50 border-rose-200'
                    : 'bg-slate-50/50 border-slate-100 text-slate-400'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-mono font-bold">
                    {isCurrent ? (
                      <Loader2 className="w-4 h-4 text-indigo-600 animate-spin" />
                    ) : isDone ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    ) : isFailed ? (
                      <AlertCircle className="w-4 h-4 text-rose-600" />
                    ) : (
                      <span className="text-slate-400">{idx + 1}</span>
                    )}
                  </div>

                  <div>
                    <h5 className={`text-xs font-semibold ${isDone ? 'text-slate-800' : isCurrent ? 'text-indigo-900' : 'text-slate-500'}`}>
                      {step.label}
                    </h5>
                    <span className="text-[10px] font-mono text-slate-400">
                      {step.status === 'running'
                        ? 'Executing WebAssembly pipeline...'
                        : step.status === 'completed'
                        ? 'Completed successfully'
                        : step.status === 'error'
                        ? step.error
                        : 'Queued'}
                    </span>
                  </div>
                </div>

                {isDone && (
                  <span className="text-[10px] font-mono text-emerald-600 font-semibold px-2 py-0.5 rounded-full bg-emerald-100">
                    Done
                  </span>
                )}
              </div>
            );
          })}
        </div>

        {/* Failure Box */}
        {errorMessage && (
          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-700 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Final Result Container */}
        {finalResult && (
          <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-200 space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                <span>Pipeline Finished ({finalResult.filename})</span>
              </span>
              <span className="text-[11px] font-mono text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
                {finalResult.blob ? formatFileSize(finalResult.blob.size) : 'Ready'}
              </span>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-100">
              {finalResult.blob && (
                <button
                  onClick={() => downloadBlob(finalResult.blob!, finalResult.filename)}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download Output</span>
                </button>
              )}

              {finalResult.blob && onSendToVault && (
                <button
                  onClick={() => {
                    const file = new File([finalResult.blob!], finalResult.filename, { type: finalResult.blob!.type });
                    onSendToVault(file);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Stage to Dead Drop Vault</span>
                </button>
              )}

              {finalResult.textPayload && onSendToScratchpad && (
                <button
                  onClick={() => {
                    onSendToScratchpad(finalResult.textPayload!);
                    onClose();
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                >
                  <FileCode className="w-3.5 h-3.5 text-cyan-600" />
                  <span>Inject to Scratchpad</span>
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="pt-2 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </motion.div>
    </div>
  );
}
