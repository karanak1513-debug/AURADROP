'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Upload,
  Download,
  Trash2,
  HardDrive,
  FileCheck,
  FileText,
  Image as ImageIcon,
  FileCode,
  Archive,
  Eye,
  X,
  RefreshCw,
  Flame,
  Shield,
  Lock,
  Sparkles,
  Music,
  Video,
  CheckCircle2,
  AlertTriangle,
  Clipboard,
  Layers,
  FileUp,
} from 'lucide-react';
import { VaultFileMetadata, Peer } from '@/types/vault';
import { encryptFileBuffer, decryptFileBuffer } from '@/lib/crypto';
import { sound } from '@/lib/sound';

interface DeadDropVaultProps {
  podId: string;
  cryptoKey: CryptoKey | null;
  files: VaultFileMetadata[];
  currentPeer: Peer;
  isReadOnly: boolean;
  onFileUploaded: () => void;
  onFileShredded: (fileId: string) => void;
}

export function DeadDropVault({
  podId,
  cryptoKey,
  files,
  currentPeer,
  isReadOnly,
  onFileUploaded,
  onFileShredded,
}: DeadDropVaultProps) {
  // Drag states
  const [isWindowDragging, setIsWindowDragging] = useState(false);
  const [isZoneDragging, setIsZoneDragging] = useState(false);
  const windowDragCounter = useRef(0);
  const zoneDragCounter = useRef(0);

  // Upload processing & queue
  const [isProcessing, setIsProcessing] = useState(false);
  const [telemetryStatus, setTelemetryStatus] = useState<string>('');
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [currentQueue, setCurrentQueue] = useState<{ name: string; size: number }[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Action states
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [shreddingId, setShreddingId] = useState<string | null>(null);
  const [burnOnDownload, setBurnOnDownload] = useState<boolean>(true);

  // In-Browser File Preview Modal State
  const [previewFile, setPreviewFile] = useState<{
    name: string;
    url?: string;
    text?: string;
    type: 'image' | 'video' | 'audio' | 'text' | 'other';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Helper for file category icon & badge
  const getFileCategoryDetails = (name: string, mime: string) => {
    const ext = name.split('.').pop()?.toLowerCase();
    if (mime.startsWith('image/') || ['png', 'jpg', 'jpeg', 'webp', 'gif', 'svg'].includes(ext || '')) {
      return {
        icon: <ImageIcon className="w-5 h-5 text-purple-400" />,
        bg: 'bg-purple-500/15 border-purple-500/30',
        label: 'IMAGE',
        type: 'image' as const,
      };
    }
    if (mime.startsWith('video/') || ['mp4', 'mov', 'webm', 'mkv'].includes(ext || '')) {
      return {
        icon: <Video className="w-5 h-5 text-rose-400" />,
        bg: 'bg-rose-500/15 border-rose-500/30',
        label: 'VIDEO',
        type: 'video' as const,
      };
    }
    if (mime.startsWith('audio/') || ['mp3', 'wav', 'ogg', 'm4a'].includes(ext || '')) {
      return {
        icon: <Music className="w-5 h-5 text-emerald-400" />,
        bg: 'bg-emerald-500/15 border-emerald-500/30',
        label: 'AUDIO',
        type: 'audio' as const,
      };
    }
    if (['js', 'ts', 'jsx', 'tsx', 'py', 'json', 'sh', 'sql', 'html', 'css', 'go', 'rs'].includes(ext || '')) {
      return {
        icon: <FileCode className="w-5 h-5 text-cyan-400" />,
        bg: 'bg-cyan-500/15 border-cyan-500/30',
        label: 'CODE',
        type: 'text' as const,
      };
    }
    if (['zip', 'tar', 'gz', '7z', 'rar'].includes(ext || '')) {
      return {
        icon: <Archive className="w-5 h-5 text-amber-400" />,
        bg: 'bg-amber-500/15 border-amber-500/30',
        label: 'ARCHIVE',
        type: 'other' as const,
      };
    }
    return {
      icon: <FileText className="w-5 h-5 text-indigo-400" />,
      bg: 'bg-indigo-500/15 border-indigo-500/30',
      label: 'DOCUMENT',
      type: 'text' as const,
    };
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  // Upload single file with client encryption & chunking resilience
  const uploadSingleFile = async (
    rawFile: globalThis.File,
    fileIndex: number,
    totalFiles: number
  ) => {
    if (rawFile.size > 25 * 1024 * 1024) {
      throw new Error(`"${rawFile.name}" exceeds the 25 MB limit.`);
    }

    if (!cryptoKey) {
      throw new Error('Encryption key not initialized. Please verify your passphrase.');
    }

    const prefix = totalFiles > 1 ? `[${fileIndex}/${totalFiles}] ` : '';

    // Step 1: Read raw bytes
    setProgressPercent(15);
    setTelemetryStatus(`${prefix}Reading file bytes…`);
    const arrayBuffer = await rawFile.arrayBuffer();

    // Step 2: Encrypt client-side using AES-256-GCM
    setProgressPercent(40);
    setTelemetryStatus(`${prefix}Encrypting with AES-256-GCM on your device…`);
    const { encryptedBlob, sha256 } = await encryptFileBuffer(
      arrayBuffer,
      rawFile.name,
      rawFile.type || 'application/octet-stream',
      cryptoKey
    );

    // Step 3: Upload envelope (single or chunked for serverless payload safety)
    setProgressPercent(60);
    setTelemetryStatus(`${prefix}Uploading encrypted envelope…`);

    const CHUNK_SIZE = 3.5 * 1024 * 1024; // 3.5 MB chunks (well below 6 MB AWS Lambda / Netlify limit)
    const fileId = `file-${Date.now().toString(36)}-${Math.random().toString(36).substring(2, 7)}`;

    if (encryptedBlob.size <= CHUNK_SIZE) {
      // Direct single-request upload
      const formData = new FormData();
      formData.append('file', encryptedBlob, rawFile.name);
      formData.append('name', rawFile.name);
      formData.append('size', String(rawFile.size));
      formData.append('mimeType', rawFile.type || 'application/octet-stream');
      formData.append('sha256', sha256);
      formData.append('uploadedBy', currentPeer.codename);
      formData.append('burnOnDownload', String(burnOnDownload));

      const res = await fetch(`/api/pods/${encodeURIComponent(podId)}/files`, {
        method: 'POST',
        body: formData,
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        const detail = errJson?.details || errJson?.error || errJson?.message || `Server returned status ${res.status}`;
        throw new Error(detail);
      }
    } else {
      // Chunked upload for files exceeding single serverless request envelope
      const totalChunks = Math.ceil(encryptedBlob.size / CHUNK_SIZE);
      for (let chunkIdx = 0; chunkIdx < totalChunks; chunkIdx++) {
        const start = chunkIdx * CHUNK_SIZE;
        const end = Math.min(start + CHUNK_SIZE, encryptedBlob.size);
        const chunkBlob = encryptedBlob.slice(start, end);

        const chunkFormData = new FormData();
        chunkFormData.append('chunk', chunkBlob);
        chunkFormData.append('fileId', fileId);
        chunkFormData.append('chunkIndex', String(chunkIdx));
        chunkFormData.append('totalChunks', String(totalChunks));
        chunkFormData.append('name', rawFile.name);
        chunkFormData.append('size', String(rawFile.size));
        chunkFormData.append('mimeType', rawFile.type || 'application/octet-stream');
        chunkFormData.append('sha256', sha256);
        chunkFormData.append('uploadedBy', currentPeer.codename);
        chunkFormData.append('burnOnDownload', String(burnOnDownload));

        const chunkPercent = Math.round(60 + ((chunkIdx + 1) / totalChunks) * 35);
        setProgressPercent(chunkPercent);
        setTelemetryStatus(`${prefix}Uploading chunk ${chunkIdx + 1} of ${totalChunks} (${Math.round((end / encryptedBlob.size) * 100)}%)…`);

        const res = await fetch(`/api/pods/${encodeURIComponent(podId)}/files/chunk`, {
          method: 'POST',
          body: chunkFormData,
        });

        if (!res.ok) {
          const errJson = await res.json().catch(() => null);
          const detail = errJson?.details || errJson?.error || errJson?.message || `Chunk ${chunkIdx + 1} upload failed (${res.status})`;
          throw new Error(detail);
        }
      }
    }

    setProgressPercent(100);
    setTelemetryStatus(`${prefix}Encrypted & sealed in memory!`);
    sound.playSuccess?.();
    onFileUploaded();
  };

  // Process batch of files (from drag-drop, file picker, or clipboard)
  const handleProcessFiles = useCallback(
    async (filesList: globalThis.File[]) => {
      if (isReadOnly || filesList.length === 0) return;

      if (!cryptoKey) {
        setErrorMessage('Encryption key not loaded. Please enter vault passphrase first.');
        sound.playAlert?.();
        return;
      }

      setIsProcessing(true);
      setErrorMessage(null);
      setCurrentQueue(filesList.map((f) => ({ name: f.name, size: f.size })));

      const errors: string[] = [];

      for (let i = 0; i < filesList.length; i++) {
        const file = filesList[i];
        try {
          await uploadSingleFile(file, i + 1, filesList.length);
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`Failed to upload ${file.name}:`, err);
          errors.push(`${file.name}: ${msg}`);
        }
      }

      setTimeout(() => {
        setIsProcessing(false);
        setProgressPercent(0);
        setTelemetryStatus('');
        setCurrentQueue([]);
      }, 700);

      if (errors.length > 0) {
        sound.playAlert?.();
        setErrorMessage(errors.join(' | '));
      }
    },
    [cryptoKey, isReadOnly, podId, currentPeer.codename, burnOnDownload, onFileUploaded]
  );

  // ── 1. Window-Wide Drag & Drop Listeners ─────────────────────────────────
  useEffect(() => {
    const handleWindowDragEnter = (e: DragEvent) => {
      e.preventDefault();
      windowDragCounter.current++;
      if (e.dataTransfer?.types?.includes('Files')) {
        setIsWindowDragging(true);
      }
    };

    const handleWindowDragOver = (e: DragEvent) => {
      e.preventDefault();
      if (e.dataTransfer) {
        e.dataTransfer.dropEffect = 'copy';
      }
    };

    const handleWindowDragLeave = (e: DragEvent) => {
      e.preventDefault();
      windowDragCounter.current--;
      if (windowDragCounter.current <= 0) {
        windowDragCounter.current = 0;
        setIsWindowDragging(false);
      }
    };

    const handleWindowDrop = (e: DragEvent) => {
      e.preventDefault();
      windowDragCounter.current = 0;
      setIsWindowDragging(false);
      setIsZoneDragging(false);

      if (e.dataTransfer?.files && e.dataTransfer.files.length > 0) {
        handleProcessFiles(Array.from(e.dataTransfer.files));
      }
    };

    window.addEventListener('dragenter', handleWindowDragEnter);
    window.addEventListener('dragover', handleWindowDragOver);
    window.addEventListener('dragleave', handleWindowDragLeave);
    window.addEventListener('drop', handleWindowDrop);

    return () => {
      window.removeEventListener('dragenter', handleWindowDragEnter);
      window.removeEventListener('dragover', handleWindowDragOver);
      window.removeEventListener('dragleave', handleWindowDragLeave);
      window.removeEventListener('drop', handleWindowDrop);
    };
  }, [handleProcessFiles]);

  // ── 2. Clipboard Paste Listener (Ctrl+V / Cmd+V) ──────────────────────────
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      if (isReadOnly || isProcessing) return;

      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA')) {
        return;
      }

      if (e.clipboardData && e.clipboardData.files && e.clipboardData.files.length > 0) {
        e.preventDefault();
        const filesArray = Array.from(e.clipboardData.files).map((f) => {
          // If screenshot or unnamed clipboard blob, assign clean timestamped name
          if (f.name === 'image.png' || !f.name) {
            return new File([f], `clipboard-${new Date().toISOString().replace(/[:.]/g, '-')}.png`, {
              type: f.type || 'image/png',
            });
          }
          return f;
        });

        sound.playClick?.();
        handleProcessFiles(filesArray);
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [isReadOnly, isProcessing, handleProcessFiles]);

  // ── 3. Dedicated Drop Zone Drag Handlers ──────────────────────────────────
  const handleZoneDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    zoneDragCounter.current++;
    setIsZoneDragging(true);
  };

  const handleZoneDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = 'copy';
    }
    if (!isZoneDragging) setIsZoneDragging(true);
  };

  const handleZoneDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    zoneDragCounter.current--;
    if (zoneDragCounter.current <= 0) {
      zoneDragCounter.current = 0;
      setIsZoneDragging(false);
    }
  };

  const handleZoneDrop = (e: React.DragEvent) => {
    e.preventDefault();
    zoneDragCounter.current = 0;
    setIsZoneDragging(false);
    setIsWindowDragging(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleProcessFiles(Array.from(e.dataTransfer.files));
    }
  };

  // Download & Decrypt In-Browser
  const handleDownloadAndDecrypt = async (
    fileMeta: VaultFileMetadata,
    triggerDownload: boolean = true
  ) => {
    if (!cryptoKey) {
      setErrorMessage('Cannot decrypt file: Encryption key not unlocked.');
      sound.playAlert?.();
      return;
    }

    try {
      setDownloadingId(fileMeta.id);
      sound.playClick?.();

      const res = await fetch(
        `/api/pods/${encodeURIComponent(podId)}/files/${encodeURIComponent(fileMeta.id)}?peerCodename=${encodeURIComponent(currentPeer.codename)}`
      );

      if (!res.ok) {
        throw new Error('File download failed or file was already burned.');
      }

      const encryptedBuffer = await res.arrayBuffer();
      const { decryptedBlob, metadata } = await decryptFileBuffer(
        encryptedBuffer,
        cryptoKey
      );

      sound.playSuccess?.();

      if (triggerDownload) {
        const downloadUrl = URL.createObjectURL(decryptedBlob);
        const a = document.createElement('a');
        a.href = downloadUrl;
        a.download = metadata.name || fileMeta.name;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(downloadUrl);

        if (fileMeta.burnOnDownload) {
          onFileShredded(fileMeta.id);
        }
      } else {
        const cat = getFileCategoryDetails(fileMeta.name, metadata.mimeType);
        if (cat.type === 'image' || cat.type === 'video' || cat.type === 'audio') {
          const previewUrl = URL.createObjectURL(decryptedBlob);
          setPreviewFile({ name: metadata.name, url: previewUrl, type: cat.type });
        } else {
          const text = await decryptedBlob.text();
          setPreviewFile({ name: metadata.name, text: text.substring(0, 15000), type: 'text' });
        }
      }
    } catch (err) {
      console.error('Download & decryption error:', err);
      sound.playAlert?.();
      setErrorMessage('Could not decrypt file: File was burned or password is incorrect.');
    } finally {
      setDownloadingId(null);
    }
  };

  // Shred / Vaporize File Instantly
  const handleShredFile = async (fileId: string) => {
    if (!confirm('Permanently destroy this file now? All encrypted buffers will be zeroized.')) {
      return;
    }

    try {
      setShreddingId(fileId);
      sound.playBurn?.();

      const res = await fetch(
        `/api/pods/${encodeURIComponent(podId)}/files/${encodeURIComponent(fileId)}`,
        { method: 'DELETE' }
      );

      if (!res.ok) throw new Error('Shred failed');

      onFileShredded(fileId);
    } catch (err) {
      console.error('Shred file error:', err);
      sound.playAlert?.();
    } finally {
      setShreddingId(null);
    }
  };

  return (
    <div className="w-full flex flex-col gap-5 sm:gap-6 animate-in fade-in duration-200 relative">
      {/* ── 0. Full-Window Holographic Drag Overlay ── */}
      {isWindowDragging && !isReadOnly && (
        <div className="fixed inset-0 z-50 bg-[#070B16]/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 border-4 border-dashed border-cyan-400 pointer-events-none transition-all">
          <div className="relative flex flex-col items-center max-w-md text-center">
            <div className="w-24 h-24 rounded-3xl bg-gradient-to-tr from-indigo-500/30 to-cyan-500/30 border border-cyan-400/50 flex items-center justify-center mb-6 shadow-[0_0_60px_rgba(6,182,212,0.4)] animate-bounce">
              <FileUp className="w-12 h-12 text-cyan-300" />
            </div>
            <h2 className="font-heading font-black text-2xl sm:text-3xl text-white mb-2 tracking-tight">
              Drop Files to Encrypt & Store
            </h2>
            <p className="text-sm text-cyan-200/90 max-w-sm mb-5 leading-relaxed">
              Drop anywhere in your browser window to seal client-side with AES-256-GCM.
            </p>
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 text-xs font-semibold text-white shadow-lg">
              <Shield className="w-4 h-4 text-emerald-400" />
              <span>Multi-File Drop · Auto-Chunking · Up to 25 MB</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Error Banner Toast ── */}
      {errorMessage && (
        <div className="rounded-2xl p-4 bg-rose-500/15 border border-rose-500/30 text-rose-200 flex items-center justify-between gap-3 shadow-xl animate-in fade-in">
          <div className="flex items-center gap-2.5 min-w-0">
            <AlertTriangle className="w-5 h-5 text-rose-400 shrink-0" />
            <p className="text-xs sm:text-sm font-medium leading-snug truncate">
              {errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setErrorMessage(null)}
            className="p-1 rounded-lg hover:bg-rose-500/20 text-rose-300 shrink-0 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* ── 1. Top Header Banner ── */}
      <div className="apple-frosted-glass rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3 sm:gap-3.5">
          <div className="w-11 h-11 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-tr from-indigo-500 to-cyan-400 p-[1.5px] shadow-md shrink-0">
            <div className="w-full h-full bg-[#0D1222] rounded-2xl flex items-center justify-center text-indigo-400">
              <HardDrive className="w-5 h-5 sm:w-6 sm:h-6" />
            </div>
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-heading font-black text-lg sm:text-xl text-white tracking-tight">
                Instant File Drop
              </h2>
              <span className="text-[10px] px-2.5 py-0.5 rounded-full font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                Open Access
              </span>
            </div>
            <p className="text-xs text-slate-400 font-normal mt-0.5 leading-relaxed">
              Client-side AES-256-GCM encryption · Burn-on-Download · Multi-File Drag & Drop
            </p>
          </div>
        </div>

        {/* Global Stats */}
        <div className="flex items-center gap-3 bg-white/5 border border-white/10 px-3.5 sm:px-4 py-2 rounded-2xl text-xs font-semibold shadow-xs self-start sm:self-auto shrink-0">
          <div className="flex items-center gap-1.5 text-slate-300">
            <HardDrive className="w-3.5 h-3.5 text-indigo-400" />
            <span>
              <strong className="text-white font-bold">{files.length}</strong> Files in Memory
            </span>
          </div>
          <span className="w-1 h-1 rounded-full bg-slate-600" />
          <div className="flex items-center gap-1.5 text-emerald-400">
            <Shield className="w-3.5 h-3.5" />
            <span>E2E Encrypted</span>
          </div>
        </div>
      </div>

      {/* ── 2. Drag & Drop Upload Zone ── */}
      <div className="apple-frosted-glass rounded-3xl p-4 sm:p-8 shadow-2xl border border-white/10 relative overflow-hidden">
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files && e.target.files.length > 0) {
              handleProcessFiles(Array.from(e.target.files));
            }
          }}
          disabled={isReadOnly || isProcessing}
        />

        <div
          onDragEnter={handleZoneDragEnter}
          onDragOver={handleZoneDragOver}
          onDragLeave={handleZoneDragLeave}
          onDrop={handleZoneDrop}
          onClick={() => {
            if (!isReadOnly && !isProcessing) {
              fileInputRef.current?.click();
            }
          }}
          className={`border-2 border-dashed rounded-3xl p-6 sm:p-12 text-center transition-all cursor-pointer relative overflow-hidden ${
            isZoneDragging
              ? 'border-cyan-400 bg-cyan-500/20 scale-[1.01] shadow-[0_0_40px_rgba(6,182,212,0.25)]'
              : 'border-white/15 hover:border-indigo-500/40 bg-black/30 hover:bg-black/50'
          } ${isProcessing ? 'pointer-events-none' : ''}`}
        >
          {isProcessing ? (
            <div className="flex flex-col items-center justify-center py-4">
              <div className="relative w-14 h-14 sm:w-16 sm:h-16 mb-4">
                <RefreshCw className="w-full h-full text-indigo-400 animate-spin" />
              </div>
              <h3 className="font-heading font-bold text-white text-sm sm:text-base mb-1">
                {telemetryStatus}
              </h3>
              <p className="text-xs text-indigo-400 font-mono font-bold">{progressPercent}%</p>
              <div className="w-56 h-2 bg-slate-800 rounded-full overflow-hidden mt-3 shadow-inner">
                <div
                  className="h-full bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-400 transition-all duration-300"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>

              {currentQueue.length > 1 && (
                <div className="mt-4 flex items-center gap-2 text-xs text-slate-400">
                  <Layers className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Processing batch of {currentQueue.length} files…</span>
                </div>
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center">
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-3xl bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 flex items-center justify-center mb-4 shadow-lg shadow-indigo-500/20 group-hover:scale-105 transition-transform">
                <Upload className="w-6 h-6 sm:w-7 sm:h-7" />
              </div>

              <h3 className="font-heading font-bold text-base sm:text-lg text-white mb-1.5">
                Drag & Drop files here, or <span className="text-indigo-400 hover:text-indigo-300 underline">browse</span>
              </h3>

              <div className="flex items-center gap-2 text-xs text-slate-400 mb-4 flex-wrap justify-center">
                <span>Multi-file supported</span>
                <span>•</span>
                <span>Up to 25 MB</span>
                <span>•</span>
                <span className="text-indigo-300 font-semibold flex items-center gap-1">
                  <Clipboard className="w-3 h-3" /> Paste with Ctrl+V
                </span>
              </div>

              {/* Upload Settings Toggle inside Dropzone */}
              <div
                onClick={(e) => e.stopPropagation()}
                className="inline-flex items-start sm:items-center gap-2.5 px-3.5 sm:px-4 py-2.5 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 shadow-xs transition-colors max-w-full text-left"
              >
                <input
                  type="checkbox"
                  id="burn-toggle-upload"
                  checked={burnOnDownload}
                  onChange={(e) => setBurnOnDownload(e.target.checked)}
                  className="w-4 h-4 rounded text-rose-500 accent-rose-500 bg-slate-950 border-slate-700 cursor-pointer shrink-0 mt-0.5 sm:mt-0"
                />
                <label
                  htmlFor="burn-toggle-upload"
                  className="text-xs text-slate-200 cursor-pointer flex flex-wrap items-center gap-1 select-none leading-snug"
                >
                  <span className="font-bold text-rose-300 flex items-center gap-1">
                    <Flame className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                    Burn on Download
                  </span>
                  <span className="text-[11px] text-slate-400 font-normal">
                    (Vaporize after 1st recipient opens)
                  </span>
                </label>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── 3. Active Shared Files Grid ── */}
      <div className="apple-frosted-glass rounded-3xl p-4 sm:p-6 shadow-2xl border border-white/10">
        <div className="flex items-center justify-between pb-4 border-b border-white/10 mb-5 flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <HardDrive className="w-4 h-4 text-indigo-400" />
            <h3 className="font-heading font-bold text-sm sm:text-base text-white tracking-tight">
              Shared Room Files ({files.length})
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-normal">
            Zero permanent storage · Ephemeral memory
          </span>
        </div>

        {files.length === 0 ? (
          <div className="py-10 sm:py-12 text-center text-slate-400">
            <div className="w-12 h-12 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-500 mx-auto mb-3">
              <HardDrive className="w-6 h-6" />
            </div>
            <p className="font-heading font-bold text-sm text-white mb-1">
              No files in the vault yet
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Drop files above or press Ctrl+V to paste screenshots. No login required.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 sm:gap-4">
            {files.map((file) => {
              const cat = getFileCategoryDetails(file.name, file.mimeType || '');
              const isDownloading = downloadingId === file.id;
              const isShredding = shreddingId === file.id;

              return (
                <div
                  key={file.id}
                  className="bg-[#0D1222]/90 hover:bg-[#12182D] rounded-2xl p-4 border border-white/10 shadow-lg hover:border-indigo-500/30 transition-all flex flex-col justify-between gap-3 group"
                >
                  {/* File Top Info */}
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border shadow-xs ${cat.bg}`}
                    >
                      {cat.icon}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-heading font-bold text-xs sm:text-sm text-white truncate" title={file.name}>
                          {file.name}
                        </p>
                        {file.burnOnDownload && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 border border-rose-500/30 shrink-0 flex items-center gap-1">
                            <Flame className="w-2.5 h-2.5" />
                            1-USE
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2 text-[11px] text-slate-400 mt-0.5 flex-wrap">
                        <span className="font-medium text-slate-300">{formatFileSize(file.size)}</span>
                        <span>·</span>
                        <span className="text-slate-400">By {file.uploadedBy}</span>
                        {file.downloadCount > 0 && (
                          <>
                            <span>·</span>
                            <span className="text-emerald-400 font-semibold">
                              {file.downloadCount} dl
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* File Action Buttons */}
                  <div className="flex items-center justify-between gap-2 pt-2.5 border-t border-white/10">
                    <div className="flex items-center gap-1.5">
                      {/* In-Browser Decrypt & Preview */}
                      <button
                        type="button"
                        onClick={() => handleDownloadAndDecrypt(file, false)}
                        disabled={isDownloading || isShredding}
                        className="px-2.5 py-1.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                        title="Decrypt and preview in browser"
                      >
                        <Eye className="w-3.5 h-3.5 text-slate-400" />
                        <span>Preview</span>
                      </button>

                      {/* Download & Decrypt */}
                      <button
                        type="button"
                        onClick={() => handleDownloadAndDecrypt(file, true)}
                        disabled={isDownloading || isShredding}
                        className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-500 hover:from-indigo-500 hover:to-cyan-400 text-white text-xs font-bold flex items-center gap-1.5 transition-all shadow-md shadow-indigo-500/20 cursor-pointer"
                      >
                        {isDownloading ? (
                          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                        ) : (
                          <Download className="w-3.5 h-3.5" />
                        )}
                        <span>{isDownloading ? 'Decrypting…' : 'Download'}</span>
                      </button>
                    </div>

                    {/* Shred Button */}
                    <button
                      type="button"
                      onClick={() => handleShredFile(file.id)}
                      disabled={isShredding || isDownloading}
                      className="p-1.5 rounded-xl bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20 transition-colors cursor-pointer"
                      title="Shred this file permanently"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── 4. In-Browser Decrypted Preview Modal ── */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
          <div className="apple-frosted-glass border border-white/10 rounded-3xl max-w-2xl w-full p-5 sm:p-6 shadow-2xl bg-[#0E1322]/98 text-white flex flex-col max-h-[85vh]">
            <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
              <div className="flex items-center gap-2">
                <FileCheck className="w-4 h-4 text-emerald-400" />
                <h4 className="font-heading font-bold text-sm text-white truncate max-w-md">
                  {previewFile.name} (Decrypted In Memory)
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto rounded-2xl bg-black/50 border border-white/10 p-4">
              {previewFile.type === 'image' && previewFile.url && (
                <div className="flex items-center justify-center">
                  <img
                    src={previewFile.url}
                    alt={previewFile.name}
                    className="max-h-[60vh] object-contain rounded-xl shadow-lg"
                  />
                </div>
              )}

              {previewFile.type === 'video' && previewFile.url && (
                <div className="flex items-center justify-center">
                  <video
                    src={previewFile.url}
                    controls
                    autoPlay
                    className="max-h-[60vh] rounded-xl shadow-lg"
                  />
                </div>
              )}

              {previewFile.type === 'audio' && previewFile.url && (
                <div className="flex items-center justify-center py-10">
                  <audio src={previewFile.url} controls autoPlay className="w-full max-w-md" />
                </div>
              )}

              {previewFile.type === 'text' && (
                <pre className="text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed select-all">
                  {previewFile.text}
                </pre>
              )}
            </div>

            <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between flex-wrap gap-2">
              <span className="text-[11px] text-slate-400">
                Decrypted directly in Web Crypto memory · Zero server log
              </span>
              <button
                type="button"
                onClick={() => setPreviewFile(null)}
                className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-colors cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
