'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { StudioToolDefinition, ToolExecutionResult } from '@/types';
import { executeTool } from '@/lib/pdf/workflow-runner';
import { downloadBlob, formatFileSize } from '@/lib/pdf/core';
import { setupSignaturePad, applyScannerFilter } from '@/lib/utils/canvas-helpers';
import { 
  X, 
  Upload, 
  Download, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Loader2, 
  Send, 
  FileCode, 
  Camera, 
  PenTool, 
  RotateCw,
  Sparkles
} from 'lucide-react';

interface ActiveToolModalProps {
  tool: StudioToolDefinition;
  onClose: () => void;
  onSendToVault?: (file: File) => void;
  onSendToScratchpad?: (text: string) => void;
}

export function ActiveToolModal({ tool, onClose, onSendToVault, onSendToScratchpad }: ActiveToolModalProps) {
  const [files, setFiles] = useState<File[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ToolExecutionResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Dynamic Tool Parameters
  const [rangeStr, setRangeStr] = useState('1-3, 5');
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [watermarkText, setWatermarkText] = useState('CONFIDENTIAL');
  const [watermarkColor, setWatermarkColor] = useState<'indigo' | 'red' | 'gray' | 'cyan'>('indigo');
  const [watermarkOpacity, setWatermarkOpacity] = useState(0.25);
  const [pageNumberFormat, setPageNumberFormat] = useState('Page {n} of {total}');
  const [pageNumberPos, setPageNumberPos] = useState<'bottom-center' | 'bottom-right' | 'top-center' | 'top-right'>('bottom-center');
  const [password, setPassword] = useState('');
  const [compressQuality, setCompressQuality] = useState<'low' | 'medium' | 'high'>('medium');
  const [targetLang, setTargetLang] = useState('Spanish');
  const [htmlContent, setHtmlContent] = useState('<h1>AURA DROP Executive Dossier</h1><p>Client-side zero-knowledge document rendering.</p>');

  // Signature Pad state
  const sigCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const sigHelperRef = useRef<{ clear: () => void; isEmpty: () => boolean; toDataURL: () => string } | null>(null);

  // Scanner state
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [capturedScans, setCapturedScans] = useState<Blob[]>([]);

  useEffect(() => {
    if (tool.id === 'sign-pdf' && sigCanvasRef.current) {
      sigHelperRef.current = setupSignaturePad(sigCanvasRef.current);
    }
  }, [tool.id]);

  // Clean camera stream on unmount
  useEffect(() => {
    return () => {
      if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(t => t.stop());
      }
    };
  }, []);

  const startCamera = async () => {
    try {
      setCameraActive(true);
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
    } catch {
      setError('Unable to access webcam. Check browser permissions.');
      setCameraActive(false);
    }
  };

  const captureFrame = () => {
    if (!videoRef.current) return;
    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth || 640;
    canvas.height = videoRef.current.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(videoRef.current, 0, 0);
      applyScannerFilter(canvas);
      canvas.toBlob(blob => {
        if (blob) {
          setCapturedScans(prev => [...prev, blob]);
        }
      }, 'image/jpeg', 0.9);
    }
  };

  const handleFileDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files) {
      const dropped = Array.from(e.dataTransfer.files);
      if (tool.inputType === 'pdf' || tool.inputType === 'office') {
        setFiles([dropped[0]]);
      } else {
        setFiles(prev => [...prev, ...dropped]);
      }
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const selected = Array.from(e.target.files);
      if (tool.inputType === 'pdf' || tool.inputType === 'office') {
        setFiles([selected[0]]);
      } else {
        setFiles(prev => [...prev, ...selected]);
      }
    }
  };

  const handleRun = async () => {
    if (tool.inputType !== 'none' && tool.id !== 'html-to-pdf' && tool.id !== 'scan-to-pdf' && files.length === 0) {
      setError('Please select or drop a target document first.');
      return;
    }

    setIsProcessing(true);
    setProgress(20);
    setError(null);
    setResult(null);

    try {
      const params: Record<string, any> = {};

      if (tool.id === 'split-pdf') {
        params.rangeStr = rangeStr;
      } else if (tool.id === 'rotate-pdf') {
        params.angle = rotateAngle;
      } else if (tool.id === 'watermark-pdf') {
        params.text = watermarkText;
        params.color = watermarkColor;
        params.opacity = watermarkOpacity;
      } else if (tool.id === 'page-numbers') {
        params.format = pageNumberFormat;
        params.position = pageNumberPos;
      } else if (tool.id === 'protect-pdf') {
        params.userPassword = password;
      } else if (tool.id === 'compress-pdf') {
        params.targetQuality = compressQuality;
      } else if (tool.id === 'translate-pdf') {
        params.targetLanguage = targetLang;
      } else if (tool.id === 'html-to-pdf') {
        params.htmlContent = htmlContent;
      } else if (tool.id === 'scan-to-pdf') {
        params.snapshots = capturedScans;
      } else if (tool.id === 'sign-pdf') {
        if (!sigHelperRef.current || sigHelperRef.current.isEmpty()) {
          throw new Error('Please sign in the signature pad box first.');
        }
        params.signatureDataUrl = sigHelperRef.current.toDataURL();
        params.pageIndex = 0;
        params.x = 200;
        params.y = 100;
        params.width = 180;
        params.height = 70;
      }

      setProgress(60);
      const res = await executeTool(tool.id, files, params);
      setProgress(100);
      setResult(res);
    } catch (err: any) {
      setError(err?.message || 'Processing failed inside client sandbox.');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleSendToVault = () => {
    if (!result?.blob || !onSendToVault) return;
    const file = new File([result.blob], result.filename, { type: result.blob.type });
    onSendToVault(file);
    onClose();
  };

  const handleSendToScratchpad = () => {
    if (!result?.textPayload || !onSendToScratchpad) return;
    onSendToScratchpad(result.textPayload);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-md animate-fade-in">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="relative w-full max-w-2xl bg-white/90 backdrop-blur-3xl rounded-3xl border border-white/95 shadow-2xl overflow-hidden max-h-[90vh] flex flex-col"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <span>{tool.title}</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-slate-100 text-slate-500">
                  {tool.outputFormat}
                </span>
              </h3>
              <p className="text-xs text-slate-500">{tool.description}</p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {/* File Ingestion Zone (if tool takes files) */}
          {tool.inputType !== 'none' && tool.id !== 'html-to-pdf' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Target Document(s) {tool.inputType === 'multiple-pdf' ? '(Batch Multiple Allowed)' : ''}
              </label>

              <div
                onDragOver={e => e.preventDefault()}
                onDrop={handleFileDrop}
                className="relative border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 text-center transition-all bg-slate-50/50 hover:bg-indigo-50/20 cursor-pointer"
              >
                <input
                  type="file"
                  onChange={handleFileInput}
                  multiple={tool.inputType === 'multiple-pdf' || tool.inputType === 'images'}
                  accept={
                    tool.inputType === 'images'
                      ? 'image/jpeg,image/png,image/webp'
                      : tool.inputType === 'office'
                      ? '.docx,.xlsx,.pptx,.csv'
                      : '.pdf'
                  }
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                />

                <Upload className="w-8 h-8 mx-auto text-indigo-500 mb-2" />
                <p className="text-xs font-semibold text-slate-700">
                  Drop files here or click to browse
                </p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Processed in local WebAssembly memory • Zero upload
                </p>
              </div>

              {/* Selected Files List */}
              {files.length > 0 && (
                <div className="mt-3 space-y-1.5">
                  {files.map((f, i) => (
                    <div
                      key={i}
                      className="flex items-center justify-between px-3 py-2 rounded-xl bg-slate-100/80 text-xs text-slate-700 font-mono"
                    >
                      <span className="truncate max-w-[320px]">{f.name}</span>
                      <span className="text-slate-400">{formatFileSize(f.size)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Dynamic Controls based on tool */}
          {tool.id === 'split-pdf' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Page Range or Commas (e.g. 1-3, 5, 8-10)
              </label>
              <input
                type="text"
                value={rangeStr}
                onChange={e => setRangeStr(e.target.value)}
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-mono text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          {tool.id === 'rotate-pdf' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-2">
                Rotation Angle (Clockwise)
              </label>
              <div className="grid grid-cols-3 gap-2">
                {([90, 180, 270] as const).map(angle => (
                  <button
                    key={angle}
                    type="button"
                    onClick={() => setRotateAngle(angle)}
                    className={`py-2 rounded-xl text-xs font-medium border flex items-center justify-center gap-1.5 cursor-pointer ${
                      rotateAngle === angle
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    <span>{angle}°</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          {tool.id === 'watermark-pdf' && (
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Watermark Text
                </label>
                <input
                  type="text"
                  value={watermarkText}
                  onChange={e => setWatermarkText(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs font-semibold text-slate-700 focus:outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tint Color
                  </label>
                  <select
                    value={watermarkColor}
                    onChange={e => setWatermarkColor(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none"
                  >
                    <option value="indigo">Electric Indigo</option>
                    <option value="cyan">Opal Cyan</option>
                    <option value="red">Warning Coral</option>
                    <option value="gray">Subtle Slate</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Opacity ({Math.round(watermarkOpacity * 100)}%)
                  </label>
                  <input
                    type="range"
                    min="0.05"
                    max="0.8"
                    step="0.05"
                    value={watermarkOpacity}
                    onChange={e => setWatermarkOpacity(parseFloat(e.target.value))}
                    className="w-full mt-2 accent-indigo-600"
                  />
                </div>
              </div>
            </div>
          )}

          {tool.id === 'protect-pdf' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Passphrase (AES-256 Client-Side Protection)
              </label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              />
            </div>
          )}

          {tool.id === 'sign-pdf' && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                  <PenTool className="w-3.5 h-3.5 text-indigo-600" />
                  <span>Interactive Vector Signature Pad</span>
                </label>
                <button
                  type="button"
                  onClick={() => sigHelperRef.current?.clear()}
                  className="text-[11px] text-slate-400 hover:text-rose-500 transition-colors cursor-pointer"
                >
                  Clear Pad
                </button>
              </div>
              <div className="border border-slate-200 rounded-2xl bg-white p-1 shadow-inner">
                <canvas
                  ref={sigCanvasRef}
                  width={560}
                  height={150}
                  className="w-full h-36 rounded-xl cursor-crosshair touch-none bg-slate-50/40"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Draw signature using your mouse, trackpad, or stylus.
              </p>
            </div>
          )}

          {tool.id === 'scan-to-pdf' && (
            <div className="space-y-3">
              {!cameraActive ? (
                <button
                  type="button"
                  onClick={startCamera}
                  className="w-full py-3 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 text-xs font-semibold flex items-center justify-center gap-2 hover:bg-indigo-100 transition-colors cursor-pointer"
                >
                  <Camera className="w-4 h-4" />
                  <span>Start Camera Scanner</span>
                </button>
              ) : (
                <div className="space-y-2">
                  <div className="relative rounded-2xl overflow-hidden bg-black aspect-video">
                    <video ref={videoRef} autoPlay playsInline className="w-full h-full object-cover" />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={captureFrame}
                      className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors cursor-pointer"
                    >
                      Capture Page ({capturedScans.length} Captured)
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {tool.id === 'html-to-pdf' && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                HTML Markup or Document Snippet
              </label>
              <textarea
                value={htmlContent}
                onChange={e => setHtmlContent(e.target.value)}
                rows={5}
                className="w-full p-3 rounded-xl bg-slate-50 border border-slate-200 font-mono text-xs text-slate-700 focus:outline-none"
              />
            </div>
          )}

          {/* Progress Bar */}
          {isProcessing && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-xs text-indigo-600 font-medium">
                <span className="flex items-center gap-1.5">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Executing WebAssembly processing engine...</span>
                </span>
                <span>{progress}%</span>
              </div>
              <div className="w-full h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 rounded-full transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Success Result Container */}
          {result && (
            <div className="p-4 rounded-2xl bg-emerald-50/80 border border-emerald-100 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-emerald-800 font-semibold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  <span>{result.title} Ready</span>
                </div>
                <span className="text-[11px] font-mono text-emerald-600 bg-emerald-100 px-2 py-0.5 rounded-full">
                  {result.blob ? formatFileSize(result.blob.size) : 'Ready'}
                </span>
              </div>

              {/* Text Payload Preview if generated */}
              {result.textPayload && (
                <div className="p-3 rounded-xl bg-white/90 border border-emerald-200 text-xs font-mono text-slate-700 max-h-36 overflow-y-auto whitespace-pre-wrap">
                  {result.textPayload}
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-emerald-100">
                {result.blob && (
                  <button
                    onClick={() => downloadBlob(result.blob!, result.filename)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Download File</span>
                  </button>
                )}

                {result.blob && onSendToVault && (
                  <button
                    onClick={handleSendToVault}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <Send className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Stage to Dead Drop Vault</span>
                  </button>
                )}

                {result.textPayload && onSendToScratchpad && (
                  <button
                    onClick={handleSendToScratchpad}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 text-xs font-semibold shadow-sm transition-colors cursor-pointer"
                  >
                    <FileCode className="w-3.5 h-3.5 text-cyan-600" />
                    <span>Inject to Ephemeral Scratchpad</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-600 text-xs font-semibold hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Cancel
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleRun}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white text-xs font-semibold shadow-md shadow-indigo-500/20 transition-all cursor-pointer"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing...</span>
              </>
            ) : (
              <span>Execute {tool.title}</span>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
}
