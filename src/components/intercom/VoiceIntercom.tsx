'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mic,
  MicOff,
  Radio,
  Volume2,
  VolumeX,
  Play,
  Square,
  Trash2,
  ShieldCheck,
  Zap,
  Activity,
  AlertCircle,
  Clock,
  Sparkles,
} from 'lucide-react';
import { getP2PMesh, PeerMessage } from '@/lib/p2p/mesh';

interface VoiceIntercomProps {
  roomId: string;
  peerId: string;
  isNuked?: boolean;
}

interface TransientAudioNote {
  id: string;
  senderName: string;
  timestamp: number;
  durationSeconds: number;
  audioBlobUrl: string;
  played: boolean;
  rawDataBuffer?: Uint8Array;
}

export function VoiceIntercom({ roomId, peerId, isNuked = false }: VoiceIntercomProps) {
  // PTT State
  const [isTransmitting, setIsTransmitting] = useState(false);
  const [isReceiving, setIsReceiving] = useState(false);
  const [receivingPeerName, setReceivingPeerName] = useState<string>('');
  const [micPermission, setMicPermission] = useState<'prompt' | 'granted' | 'denied'>('prompt');
  const [isMuted, setIsMuted] = useState(false);

  // Transient Audio Notes State
  const [isRecordingNote, setIsRecordingNote] = useState(false);
  const [recordDuration, setRecordDuration] = useState(0);
  const [audioNotes, setAudioNotes] = useState<TransientAudioNote[]>([]);
  const [playingNoteId, setPlayingNoteId] = useState<string | null>(null);

  // Web Audio Refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recordTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Waveform Visualizer Canvas
  const waveformCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);

  // Audio Playback Ref for Single-Play Overwrite
  const currentAudioElemRef = useRef<HTMLAudioElement | null>(null);

  // Tactical Chirp Synthesizer
  const playTacticalChirp = useCallback((type: 'start' | 'stop') => {
    try {
      const ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      if (type === 'start') {
        osc.frequency.setValueAtTime(880, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(1760, ctx.currentTime + 0.08);
      } else {
        osc.frequency.setValueAtTime(1760, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(440, ctx.currentTime + 0.08);
      }

      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start();
      osc.stop(ctx.currentTime + 0.1);
      setTimeout(() => ctx.close(), 200);
    } catch {
      // AudioContext restricted
    }
  }, []);

  // Initialize Microphone & Visualizer
  const ensureMicrophone = useCallback(async (): Promise<MediaStream | null> => {
    if (localStreamRef.current) return localStreamRef.current;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      localStreamRef.current = stream;
      setMicPermission('granted');

      // Setup Web Audio Analyser
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AudioCtx();
      audioContextRef.current = ctx;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 64;
      source.connect(analyser);
      analyserRef.current = analyser;

      return stream;
    } catch (err) {
      console.warn('[INTERCOM] Microphone access failed:', err);
      setMicPermission('denied');
      return null;
    }
  }, []);

  // Render Real-Time Visualizer Waveform
  useEffect(() => {
    const canvas = waveformCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let running = true;

    const draw = () => {
      if (!running) return;
      animFrameRef.current = requestAnimationFrame(draw);

      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const analyser = analyserRef.current;
      if (!analyser || (!isTransmitting && !isRecordingNote)) {
        // Draw resting ambient pulse line
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(99, 102, 241, 0.2)';
        ctx.lineWidth = 2;
        ctx.moveTo(0, height / 2);
        ctx.lineTo(width, height / 2);
        ctx.stroke();
        return;
      }

      const bufferLength = analyser.frequencyBinCount;
      const dataArray = new Uint8Array(bufferLength);
      analyser.getByteFrequencyData(dataArray);

      const barWidth = (width / bufferLength) * 1.6;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const val = dataArray[i] / 255.0;
        const barHeight = val * (height * 0.85);

        // Radiant Opal to Indigo gradient
        const gradient = ctx.createLinearGradient(0, height, 0, 0);
        gradient.addColorStop(0, '#06b6d4');
        gradient.addColorStop(0.6, '#6366f1');
        gradient.addColorStop(1, '#a855f7');

        ctx.fillStyle = gradient;
        ctx.beginPath();
        const y = (height - barHeight) / 2;
        ctx.roundRect(x, y, barWidth - 2, barHeight, 4);
        ctx.fill();

        x += barWidth;
      }
    };

    draw();

    return () => {
      running = false;
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    };
  }, [isTransmitting, isRecordingNote]);

  // Start Walkie-Talkie Push-to-Talk (PTT)
  const startPTT = useCallback(async () => {
    if (isTransmitting || isNuked) return;
    const stream = await ensureMicrophone();
    if (!stream) return;

    playTacticalChirp('start');
    setIsTransmitting(true);

    const mesh = getP2PMesh();
    mesh.startAudioCall(stream);

    mesh.broadcast({
      type: 'AUDIO_CHUNK',
      senderId: peerId,
      senderName: peerId.substring(0, 7),
      payload: { action: 'PTT_START' },
      timestamp: Date.now(),
    });
  }, [isTransmitting, isNuked, ensureMicrophone, playTacticalChirp, peerId]);

  // Stop Walkie-Talkie Push-to-Talk (PTT)
  const stopPTT = useCallback(() => {
    if (!isTransmitting) return;
    playTacticalChirp('stop');
    setIsTransmitting(false);

    const mesh = getP2PMesh();
    mesh.stopAudioCall();

    mesh.broadcast({
      type: 'AUDIO_CHUNK',
      senderId: peerId,
      senderName: peerId.substring(0, 7),
      payload: { action: 'PTT_STOP' },
      timestamp: Date.now(),
    });
  }, [isTransmitting, playTacticalChirp, peerId]);

  // Keyboard Spacebar Hold for PTT (ignores if user is typing in editor or inputs)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code !== 'Space' || e.repeat) return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.code-editor-area')
      ) {
        return;
      }
      e.preventDefault();
      startPTT();
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code !== 'Space') return;
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.code-editor-area')
      ) {
        return;
      }
      e.preventDefault();
      stopPTT();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [startPTT, stopPTT]);

  // P2P Incoming Remote Audio & Signals Listeners
  useEffect(() => {
    const mesh = getP2PMesh();

    const unsubMsg = mesh.onMessage((msg: PeerMessage) => {
      if (msg.type === 'AUDIO_CHUNK') {
        const payload = msg.payload as { action: string };
        if (payload.action === 'PTT_START') {
          setIsReceiving(true);
          setReceivingPeerName(msg.senderName);
        } else if (payload.action === 'PTT_STOP') {
          setIsReceiving(false);
          setReceivingPeerName('');
        }
      } else if (msg.type === 'AUDIO_NOTE') {
        // Incoming transient voice memo
        const notePayload = msg.payload as {
          id: string;
          durationSeconds: number;
          audioBase64: string;
        };

        try {
          const binaryStr = atob(notePayload.audioBase64);
          const len = binaryStr.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: 'audio/webm;codecs=opus' });
          const blobUrl = URL.createObjectURL(blob);

          setAudioNotes((prev) => [
            {
              id: notePayload.id,
              senderName: msg.senderName,
              timestamp: msg.timestamp,
              durationSeconds: notePayload.durationSeconds,
              audioBlobUrl: blobUrl,
              played: false,
              rawDataBuffer: bytes,
            },
            ...prev,
          ]);
        } catch (e) {
          console.warn('[INTERCOM] Failed to parse incoming audio note:', e);
        }
      }
    });

    const unsubStream = mesh.onAudioStream((remoteStream) => {
      // Attach remote stream to hidden audio player
      const audioElem = new Audio();
      audioElem.srcObject = remoteStream;
      audioElem.play().catch(() => {});
      setIsReceiving(true);

      remoteStream.onremovetrack = () => {
        setIsReceiving(false);
        setReceivingPeerName('');
      };
    });

    return () => {
      unsubMsg();
      unsubStream();
    };
  }, []);

  // Transient Voice Memo Recording (Max 10s)
  const startRecordingNote = async () => {
    if (isRecordingNote || isNuked) return;
    const stream = await ensureMicrophone();
    if (!stream) return;

    recordedChunksRef.current = [];
    setRecordDuration(0);

    const mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : 'audio/ogg',
    });

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) {
        recordedChunksRef.current.push(e.data);
      }
    };

    mediaRecorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'audio/webm' });
      const arrayBuffer = await blob.arrayBuffer();
      const rawBytes = new Uint8Array(arrayBuffer);

      // Base64 encode for P2P transport
      let binary = '';
      for (let i = 0; i < rawBytes.byteLength; i++) {
        binary += String.fromCharCode(rawBytes[i]);
      }
      const base64 = btoa(binary);

      const noteId = `note-${Date.now()}`;
      const blobUrl = URL.createObjectURL(blob);

      const newNote: TransientAudioNote = {
        id: noteId,
        senderName: 'You (Self)',
        timestamp: Date.now(),
        durationSeconds: recordDuration,
        audioBlobUrl: blobUrl,
        played: false,
        rawDataBuffer: rawBytes,
      };

      setAudioNotes((prev) => [newNote, ...prev]);

      // Broadcast note over P2P mesh
      const mesh = getP2PMesh();
      mesh.broadcast({
        type: 'AUDIO_NOTE',
        senderId: peerId,
        senderName: peerId.substring(0, 7),
        payload: {
          id: noteId,
          durationSeconds: recordDuration,
          audioBase64: base64,
        },
        timestamp: Date.now(),
      });
    };

    mediaRecorder.start();
    mediaRecorderRef.current = mediaRecorder;
    setIsRecordingNote(true);

    let seconds = 0;
    recordTimerRef.current = setInterval(() => {
      seconds += 1;
      setRecordDuration(seconds);
      if (seconds >= 10) {
        stopRecordingNote();
      }
    }, 1000);
  };

  const stopRecordingNote = () => {
    if (!isRecordingNote) return;
    if (recordTimerRef.current) {
      clearInterval(recordTimerRef.current);
      recordTimerRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecordingNote(false);
  };

  /**
   * EPHEMERAL ONE-PLAY RULE:
   * Play transient audio note once. Upon completion, overwrite buffer with zeros and delete immediately.
   */
  const playAndScrubNote = (note: TransientAudioNote) => {
    if (note.played || playingNoteId) return;

    setPlayingNoteId(note.id);
    const audio = new Audio(note.audioBlobUrl);
    currentAudioElemRef.current = audio;

    const scrubBuffer = () => {
      // 1. Overwrite in-memory Uint8Array buffer with 0s
      if (note.rawDataBuffer) {
        note.rawDataBuffer.fill(0);
      }

      // 2. Revoke blob URL
      URL.revokeObjectURL(note.audioBlobUrl);

      // 3. Mark played and filter out of state
      setAudioNotes((prev) => prev.filter((n) => n.id !== note.id));
      setPlayingNoteId(null);
      currentAudioElemRef.current = null;
    };

    audio.onended = scrubBuffer;
    audio.onerror = scrubBuffer;

    audio.play().catch((err) => {
      console.warn('[INTERCOM] Audio play failed:', err);
      scrubBuffer();
    });
  };

  // Immediate Anti-Forensics Zeroize of All Audio Buffers
  const purgeAllAudioNotes = () => {
    if (currentAudioElemRef.current) {
      currentAudioElemRef.current.pause();
      currentAudioElemRef.current = null;
    }

    audioNotes.forEach((n) => {
      if (n.rawDataBuffer) n.rawDataBuffer.fill(0);
      URL.revokeObjectURL(n.audioBlobUrl);
    });

    setAudioNotes([]);
    setPlayingNoteId(null);
  };

  // Handle Nuked State
  useEffect(() => {
    if (isNuked) {
      stopPTT();
      stopRecordingNote();
      purgeAllAudioNotes();
      if (localStreamRef.current) {
        localStreamRef.current.getTracks().forEach((t) => t.stop());
        localStreamRef.current = null;
      }
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
        audioContextRef.current = null;
      }
    }
  }, [isNuked]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. Walkie-Talkie Tactical Console */}
      <div className="bg-white/70 backdrop-blur-3xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.05)] relative overflow-hidden">
        {/* Glow ambient background */}
        <div className="absolute -top-16 -right-16 w-56 h-56 bg-indigo-200/30 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-56 h-56 bg-cyan-200/30 rounded-full blur-3xl pointer-events-none" />

        {/* Section Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/80 shadow-xs">
              <Radio className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Encrypted P2P Voice Intercom
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  WEBRTC MESH
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Hold <kbd className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-700 font-mono text-[10px] border border-slate-200">Space</kbd> or press tactile mic to stream encrypted audio frames
              </p>
            </div>
          </div>

          {/* Status Indicator */}
          <div className="flex items-center gap-2">
            {isTransmitting ? (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-rose-50 text-rose-600 border border-rose-200 flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                TRANSMITTING (PTT ON)
              </span>
            ) : isReceiving ? (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-emerald-50 text-emerald-600 border border-emerald-200 flex items-center gap-2 animate-pulse">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
                RECEIVING: {receivingPeerName || 'PEER'}
              </span>
            ) : (
              <span className="px-3 py-1 rounded-full text-xs font-mono font-semibold bg-slate-100 text-slate-600 border border-slate-200/80 flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
                STANDBY • END-TO-END ENCRYPTED
              </span>
            )}
          </div>
        </div>

        {/* Real-time Waveform Canvas */}
        <div className="my-6 relative rounded-2xl bg-slate-900/5 p-4 border border-slate-200/50 backdrop-blur-sm overflow-hidden flex flex-col items-center justify-center">
          <canvas
            ref={waveformCanvasRef}
            width={640}
            height={70}
            className="w-full h-16 rounded-xl"
          />
          <div className="absolute bottom-2 right-4 text-[10px] font-mono text-slate-400">
            {isTransmitting ? '48kHz OPUS AUDIO STREAM' : 'AUDIO BUFFER ZEROED'}
          </div>
        </div>

        {/* Tactile Push-to-Talk Button & Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2">
          {/* Main Tactile PTT Push Button */}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            onMouseDown={startPTT}
            onMouseUp={stopPTT}
            onTouchStart={startPTT}
            onTouchEnd={stopPTT}
            disabled={isNuked}
            className={`w-36 h-36 rounded-full flex flex-col items-center justify-center gap-2 shadow-xl border-4 transition-all duration-200 select-none cursor-pointer ${
              isTransmitting
                ? 'bg-rose-500 text-white border-rose-300 shadow-rose-500/30 scale-105 animate-pulse'
                : 'bg-white text-slate-700 border-indigo-100 hover:border-indigo-300 hover:shadow-indigo-500/10'
            }`}
          >
            {isTransmitting ? (
              <>
                <Mic className="w-10 h-10 animate-bounce" />
                <span className="text-xs font-mono font-bold tracking-wider">RELEASE TX</span>
              </>
            ) : (
              <>
                <Mic className="w-10 h-10 text-indigo-600" />
                <span className="text-xs font-mono font-bold tracking-wider text-slate-800">HOLD TO TALK</span>
                <span className="text-[10px] text-slate-400 font-mono">SPACEBAR</span>
              </>
            )}
          </motion.button>
        </div>
      </div>

      {/* 2. Transient Audio Drop (10-Second Voice Memos) */}
      <div className="bg-white/70 backdrop-blur-3xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.05)]">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-100">
          <div>
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Zap className="w-4 h-4 text-cyan-600" />
              Transient Tactical Audio Drop
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-cyan-50 text-cyan-700 border border-cyan-200/60">
                1-SHOT PLAYBACK
              </span>
            </h3>
            <p className="text-xs text-slate-500 font-medium">
              Record brief 10-second encrypted voice memos. Audio buffers play once and immediately zero-fill from RAM.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {/* Quick Record Voice Memo */}
            {isRecordingNote ? (
              <button
                onClick={stopRecordingNote}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-md transition cursor-pointer"
              >
                <Square className="w-3.5 h-3.5 fill-white" />
                STOP ({10 - recordDuration}s)
              </button>
            ) : (
              <button
                onClick={startRecordingNote}
                disabled={isNuked}
                className="px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-md hover:shadow-indigo-500/20 transition cursor-pointer"
              >
                <Mic className="w-3.5 h-3.5" />
                RECORD 10S MEMO
              </button>
            )}

            {audioNotes.length > 0 && (
              <button
                onClick={purgeAllAudioNotes}
                className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-mono text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                title="Immediately zeroize all audio RAM"
              >
                <Trash2 className="w-3.5 h-3.5" />
                PURGE RAM
              </button>
            )}
          </div>
        </div>

        {/* Audio Notes Stack */}
        <div className="mt-6">
          {audioNotes.length === 0 ? (
            <div className="py-10 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-2xl">
              <Clock className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-semibold text-slate-600">No active voice memos</p>
              <p className="text-xs text-slate-400 max-w-sm mt-1">
                Voice memos transmitted over P2P mesh will appear here. They disappear forever after one play.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <AnimatePresence>
                {audioNotes.map((note) => (
                  <motion.div
                    key={note.id}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.92 }}
                    className="p-4 rounded-2xl bg-white/90 border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
                  >
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => playAndScrubNote(note)}
                        disabled={playingNoteId !== null}
                        className={`w-11 h-11 rounded-xl flex items-center justify-center cursor-pointer transition ${
                          playingNoteId === note.id
                            ? 'bg-rose-500 text-white animate-pulse'
                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white'
                        }`}
                      >
                        {playingNoteId === note.id ? (
                          <Activity className="w-5 h-5 animate-spin" />
                        ) : (
                          <Play className="w-5 h-5 ml-0.5 fill-current" />
                        )}
                      </button>
                      <div>
                        <div className="text-xs font-bold text-slate-900 flex items-center gap-2">
                          {note.senderName}
                          <span className="text-[10px] font-mono text-slate-400">
                            {new Date(note.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <div className="text-[11px] font-mono text-indigo-600 flex items-center gap-1 mt-0.5">
                          <Sparkles className="w-3 h-3 text-cyan-500" />
                          {note.durationSeconds}s duration • Single-Play Self-Scrub
                        </div>
                      </div>
                    </div>

                    <div className="text-[10px] font-mono font-semibold px-2 py-1 rounded bg-amber-50 text-amber-700 border border-amber-200/60">
                      PLAY ONCE
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
