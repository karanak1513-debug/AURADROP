'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  EyeOff,
  Eye,
  Lock,
  Unlock,
  Upload,
  Download,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Key,
  Copy,
  Check,
  Trash2,
  FileImage,
  Sparkles,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { getP2PMesh } from '@/lib/p2p/mesh';
import { encryptText, decryptText, generateKeyFromPassphrase, computeSHA256 } from '@/lib/crypto';

interface StegoVaultProps {
  roomId: string;
  peerId: string;
  isNuked?: boolean;
}

const STEGO_MAGIC_HEADER = 'AURA_STEGO_V1:';

export function StegoVault({ roomId, peerId, isNuked = false }: StegoVaultProps) {
  // Stego Mode: 'embed' | 'extract'
  const [activeMode, setActiveMode] = useState<'embed' | 'extract'>('embed');

  // Embed State
  const [embedImage, setEmbedImage] = useState<string | null>(null);
  const [embedFileName, setEmbedFileName] = useState<string>('');
  const [secretMessage, setSecretMessage] = useState<string>('');
  const [embedPassphrase, setEmbedPassphrase] = useState<string>('');
  const [isEmbedding, setIsEmbedding] = useState<boolean>(false);
  const [encodedResultUrl, setEncodedResultUrl] = useState<string | null>(null);

  // Extract State
  const [extractImage, setExtractImage] = useState<string | null>(null);
  const [extractPassphrase, setExtractPassphrase] = useState<string>('');
  const [extractedMessage, setExtractedMessage] = useState<string | null>(null);
  const [extractedHash, setExtractedHash] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState<boolean>(false);
  const [extractError, setExtractError] = useState<string | null>(null);
  const [copied, setCopied] = useState<boolean>(false);

  // Device-Locked Gatekeeper State
  const [max2Locked, setMax2Locked] = useState<boolean>(false);
  const [connectedNodes, setConnectedNodes] = useState<number>(1);

  const embedCanvasRef = useRef<HTMLCanvasElement>(null);
  const extractCanvasRef = useRef<HTMLCanvasElement>(null);

  // Peer Gatekeeper Listener
  useEffect(() => {
    const mesh = getP2PMesh();
    const unsub = mesh.onPeerStatus((peers, lockStatus) => {
      setMax2Locked(lockStatus.max2Locked);
      setConnectedNodes(lockStatus.count);
    });
    return () => unsub();
  }, []);

  const toggleMax2Lock = () => {
    const mesh = getP2PMesh();
    const updated = !max2Locked;
    setMax2Locked(updated);
    mesh.setMax2PeersLock(updated);
  };

  // 1. Ingest Image for Embedding
  const handleEmbedFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setEmbedFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setEmbedImage(ev.target?.result as string);
      setEncodedResultUrl(null);
    };
    reader.readAsDataURL(file);
  };

  // 2. Perform LSB Encoding (Least Significant Bit Steganography)
  const processLSBEmbedding = async () => {
    if (!embedImage || !secretMessage.trim()) return;
    setIsEmbedding(true);

    try {
      // Step A: Prepare payload (encrypt if passphrase provided)
      let finalPayload = secretMessage;
      if (embedPassphrase.trim()) {
        const dummySalt = 'AURA_STEGO_SALT_FIXED_B64==';
        const key = await generateKeyFromPassphrase(embedPassphrase.trim(), dummySalt);
        const { ciphertext, iv } = await encryptText(secretMessage, key);
        finalPayload = `ENC:${iv}:${ciphertext}`;
      }

      const fullString = `${STEGO_MAGIC_HEADER}${finalPayload}`;
      const enc = new TextEncoder();
      const stringBytes = enc.encode(fullString);
      const payloadLength = stringBytes.length;

      // Load image into canvas
      const img = new Image();
      img.src = embedImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = embedCanvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Check capacity: each byte needs 8 bits (8 color channels)
      // 4 bytes for length prefix + payloadLength
      const totalBitsNeeded = (4 + payloadLength) * 8;
      const totalAvailableChannels = canvas.width * canvas.height * 3; // use RGB channels (skip Alpha)

      if (totalBitsNeeded > totalAvailableChannels) {
        alert(`Image is too small to embed ${payloadLength} bytes. Please select a larger image.`);
        setIsEmbedding(false);
        return;
      }

      // Pack 32-bit length header
      const headerBytes = new Uint8Array(4);
      new DataView(headerBytes.buffer).setUint32(0, payloadLength, false);

      const allDataToEmbed = new Uint8Array(4 + payloadLength);
      allDataToEmbed.set(headerBytes, 0);
      allDataToEmbed.set(stringBytes, 4);

      // Embed into LSB of R, G, B
      let byteIdx = 0;
      let bitIdx = 0;

      for (let i = 0; i < data.length && byteIdx < allDataToEmbed.length; i++) {
        // Skip Alpha channel (i % 4 === 3)
        if (i % 4 === 3) continue;

        const currentByte = allDataToEmbed[byteIdx];
        const bit = (currentByte >> (7 - bitIdx)) & 1;

        // Clear LSB and write payload bit
        data[i] = (data[i] & 0xfe) | bit;

        bitIdx++;
        if (bitIdx === 8) {
          bitIdx = 0;
          byteIdx++;
        }
      }

      ctx.putImageData(imgData, 0, 0);
      const resultDataUrl = canvas.toDataURL('image/png');
      setEncodedResultUrl(resultDataUrl);
    } catch (err) {
      console.error('[STEGO] Embedding failed:', err);
      alert('Steganography embedding failed.');
    } finally {
      setIsEmbedding(false);
    }
  };

  // 3. Ingest Image for Extraction
  const handleExtractFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      setExtractImage(ev.target?.result as string);
      setExtractedMessage(null);
      setExtractError(null);
      setExtractedHash(null);
    };
    reader.readAsDataURL(file);
  };

  // 4. Perform LSB Extraction
  const processLSBExtraction = async () => {
    if (!extractImage) return;
    setIsExtracting(true);
    setExtractError(null);
    setExtractedMessage(null);

    try {
      const img = new Image();
      img.src = extractImage;
      await new Promise((resolve) => (img.onload = resolve));

      const canvas = extractCanvasRef.current || document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas context unavailable');

      ctx.drawImage(img, 0, 0);
      const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imgData.data;

      // Extract 32-bit length prefix (32 bits = 32 color channels)
      let lengthBytes = 0;
      let bitsRead = 0;
      let channelIdx = 0;

      while (bitsRead < 32 && channelIdx < data.length) {
        if (channelIdx % 4 === 3) {
          channelIdx++;
          continue;
        }
        const bit = data[channelIdx] & 1;
        lengthBytes = (lengthBytes << 1) | bit;
        bitsRead++;
        channelIdx++;
      }

      if (lengthBytes <= 0 || lengthBytes > 10_000_000) {
        throw new Error('No valid AURA DROP steganographic signature detected in image LSB.');
      }

      // Extract payload bytes
      const extractedBytes = new Uint8Array(lengthBytes);
      let curByte = 0;
      let curBit = 0;
      let bytesCollected = 0;

      while (bytesCollected < lengthBytes && channelIdx < data.length) {
        if (channelIdx % 4 === 3) {
          channelIdx++;
          continue;
        }
        const bit = data[channelIdx] & 1;
        curByte = (curByte << 1) | bit;
        curBit++;

        if (curBit === 8) {
          extractedBytes[bytesCollected] = curByte;
          bytesCollected++;
          curByte = 0;
          curBit = 0;
        }
        channelIdx++;
      }

      const rawDecoded = new TextDecoder().decode(extractedBytes);

      if (!rawDecoded.startsWith(STEGO_MAGIC_HEADER)) {
        throw new Error('Image does not contain a recognized AURA DROP steganographic signature.');
      }

      const payloadContent = rawDecoded.substring(STEGO_MAGIC_HEADER.length);

      // Check if encrypted
      if (payloadContent.startsWith('ENC:')) {
        const parts = payloadContent.split(':');
        const iv = parts[1];
        const ciphertext = parts[2];

        if (!extractPassphrase.trim()) {
          setExtractError('Payload is password-protected. Please enter the decryption passphrase.');
          setIsExtracting(false);
          return;
        }

        const dummySalt = 'AURA_STEGO_SALT_FIXED_B64==';
        const key = await generateKeyFromPassphrase(extractPassphrase.trim(), dummySalt);
        const decrypted = await decryptText(ciphertext, iv, key);

        setExtractedMessage(decrypted);
        const hash = await computeSHA256(decrypted);
        setExtractedHash(hash);
      } else {
        setExtractedMessage(payloadContent);
        const hash = await computeSHA256(payloadContent);
        setExtractedHash(hash);
      }
    } catch (err: unknown) {
      setExtractError((err as Error).message || 'Extraction failed.');
    } finally {
      setIsExtracting(false);
    }
  };

  const copyExtracted = () => {
    if (!extractedMessage) return;
    navigator.clipboard.writeText(extractedMessage);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Anti-Forensics Zeroize
  useEffect(() => {
    if (isNuked) {
      setEmbedImage(null);
      setSecretMessage('');
      setEmbedPassphrase('');
      setEncodedResultUrl(null);
      setExtractImage(null);
      setExtractedMessage(null);
      setExtractedHash(null);
    }
  }, [isNuked]);

  return (
    <div className="w-full flex flex-col gap-6">
      {/* 1. Strict Peer Gatekeeper Card */}
      <div className="bg-white/70 backdrop-blur-3xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.05)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border shadow-xs transition ${
            max2Locked
              ? 'bg-rose-50 text-rose-600 border-rose-200'
              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
          }`}>
            {max2Locked ? <Lock className="w-6 h-6" /> : <Unlock className="w-6 h-6" />}
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-base font-bold text-slate-900">Device-Locked Access Gatekeeper</h3>
              <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                max2Locked
                  ? 'bg-rose-50 text-rose-700 border-rose-200'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-200'
              }`}>
                {max2Locked ? 'STRICT LOCK ACTIVE' : 'OPEN MESH'}
              </span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              {max2Locked
                ? 'Maximum 2 Peers Lock engaged: Room permanently rejects any additional connection attempts.'
                : 'Any peer with URL fragment can join mesh.'}
            </p>
          </div>
        </div>

        {/* Lock Switch & Badge */}
        <div className="flex items-center gap-3">
          <div className="px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-xs font-mono font-semibold text-slate-700">
            NODES: <span className="text-indigo-600 font-bold">{connectedNodes} / 2</span>
          </div>

          <button
            onClick={toggleMax2Lock}
            className={`px-4 py-2 rounded-xl font-mono text-xs font-bold transition flex items-center gap-2 cursor-pointer shadow-xs ${
              max2Locked
                ? 'bg-rose-600 hover:bg-rose-700 text-white'
                : 'bg-indigo-600 hover:bg-indigo-700 text-white'
            }`}
          >
            {max2Locked ? <Lock className="w-3.5 h-3.5" /> : <Shield className="w-3.5 h-3.5" />}
            {max2Locked ? 'DISABLE LOCK' : 'ENGAGE 2-PEER LOCK'}
          </button>
        </div>
      </div>

      {/* 2. Steganography Image Hiding Vault */}
      <div className="bg-white/70 backdrop-blur-3xl border border-white/90 rounded-3xl p-6 sm:p-8 shadow-[0_20px_45px_-15px_rgba(0,0,0,0.05)] flex flex-col gap-6">
        {/* Module Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border border-indigo-100/80 shadow-xs">
              <EyeOff className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
                Steganography Vault
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                  LSB PIXEL ENGINE
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Conceal encrypted secrets inside normal image pixels with zero visible distortion.
              </p>
            </div>
          </div>

          {/* Mode Switcher */}
          <div className="flex items-center p-1 rounded-xl bg-slate-100 border border-slate-200/80">
            <button
              onClick={() => setActiveMode('embed')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'embed'
                  ? 'bg-white text-indigo-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <EyeOff className="w-3.5 h-3.5" />
              EMBED SECRET
            </button>
            <button
              onClick={() => setActiveMode('extract')}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition cursor-pointer flex items-center gap-1.5 ${
                activeMode === 'extract'
                  ? 'bg-white text-cyan-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Eye className="w-3.5 h-3.5" />
              EXTRACT SECRET
            </button>
          </div>
        </div>

        {/* Mode Content */}
        {activeMode === 'embed' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Input Image & Payload */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-2">
                  1. SELECT CARRIER IMAGE (PNG/JPG)
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-indigo-400 rounded-2xl p-6 cursor-pointer bg-slate-50/50 hover:bg-indigo-50/20 transition">
                  <Upload className="w-8 h-8 text-indigo-500 mb-2" />
                  <span className="text-xs font-bold text-slate-700">
                    {embedFileName || 'Click or drag image here'}
                  </span>
                  <span className="text-[11px] text-slate-400 mt-1">High-resolution PNG/JPG recommended</span>
                  <input type="file" accept="image/*" onChange={handleEmbedFileChange} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-2">
                  2. CONFIDENTIAL SECRET PAYLOAD
                </label>
                <textarea
                  value={secretMessage}
                  onChange={(e) => setSecretMessage(e.target.value)}
                  placeholder="Enter secret message, private key, or tactical coordinates..."
                  rows={4}
                  className="w-full rounded-xl border border-slate-200 p-3 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                />
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-2">
                  3. OPTIONAL AES-256 ENCRYPTION PASSPHRASE
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={embedPassphrase}
                    onChange={(e) => setEmbedPassphrase(e.target.value)}
                    placeholder="Leave empty for unencrypted LSB or enter key"
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500/20 bg-white"
                  />
                </div>
              </div>

              <button
                onClick={processLSBEmbedding}
                disabled={!embedImage || !secretMessage.trim() || isEmbedding}
                className="w-full py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-indigo-500/20 transition cursor-pointer"
              >
                <Sparkles className="w-4 h-4" />
                {isEmbedding ? 'ENCODING LSB PIXELS...' : 'EMBED SECRET INTO PIXELS'}
              </button>
            </div>

            {/* Right: Output Preview & Download */}
            <div className="flex flex-col items-center justify-center border border-slate-200/80 rounded-2xl p-6 bg-slate-50/40 relative">
              {encodedResultUrl ? (
                <div className="flex flex-col items-center gap-4 w-full">
                  <div className="text-xs font-mono font-bold text-emerald-600 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4" />
                    LSB STEGO INJECTION COMPLETE
                  </div>

                  <img
                    src={encodedResultUrl}
                    alt="Steganographic Result"
                    className="max-h-56 rounded-xl border border-slate-300 shadow-md object-contain"
                  />

                  <p className="text-[11px] text-slate-500 text-center max-w-xs">
                    Pixels contain your encrypted payload. Download the lossless PNG to transfer out-of-band.
                  </p>

                  <a
                    href={encodedResultUrl}
                    download={`AURA-STEGO-${Date.now()}.png`}
                    className="px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-mono text-xs font-bold flex items-center gap-2 shadow-md transition"
                  >
                    <Download className="w-4 h-4" />
                    DOWNLOAD STEGO PNG
                  </a>
                </div>
              ) : embedImage ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={embedImage}
                    alt="Carrier Preview"
                    className="max-h-52 rounded-xl border border-slate-200 opacity-70 object-contain"
                  />
                  <span className="text-xs font-mono text-slate-500">Carrier ready for injection</span>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-slate-400 py-16">
                  <FileImage className="w-10 h-10 mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-slate-500">Carrier preview will appear here</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Extract Mode */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Left: Input Image */}
            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-2">
                  DROP ENCODED STEGO IMAGE (PNG)
                </label>
                <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-200 hover:border-cyan-400 rounded-2xl p-6 cursor-pointer bg-slate-50/50 hover:bg-cyan-50/20 transition">
                  <Upload className="w-8 h-8 text-cyan-500 mb-2" />
                  <span className="text-xs font-bold text-slate-700">
                    {extractImage ? 'Image Selected' : 'Click or drop encoded PNG'}
                  </span>
                  <input type="file" accept="image/png" onChange={handleExtractFileChange} className="hidden" />
                </label>
              </div>

              <div>
                <label className="block text-xs font-mono font-semibold text-slate-700 mb-2">
                  DECRYPTION PASSPHRASE (IF ENCRYPTED)
                </label>
                <div className="relative">
                  <Key className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  <input
                    type="password"
                    value={extractPassphrase}
                    onChange={(e) => setExtractPassphrase(e.target.value)}
                    placeholder="Enter passphrase used during embedding"
                    className="w-full rounded-xl border border-slate-200 pl-9 pr-3 py-2.5 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-cyan-500/20 bg-white"
                  />
                </div>
              </div>

              <button
                onClick={processLSBExtraction}
                disabled={!extractImage || isExtracting}
                className="w-full py-3 rounded-xl bg-cyan-600 hover:bg-cyan-700 disabled:opacity-50 text-white font-mono text-xs font-bold flex items-center justify-center gap-2 shadow-md hover:shadow-cyan-500/20 transition cursor-pointer"
              >
                <Eye className="w-4 h-4" />
                {isExtracting ? 'SCANNING LSB PIXELS...' : 'EXTRACT & DECRYPT SECRET'}
              </button>

              {extractError && (
                <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-mono flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{extractError}</span>
                </div>
              )}
            </div>

            {/* Right: Decrypted Secret Display */}
            <div className="flex flex-col border border-slate-200/80 rounded-2xl p-6 bg-slate-50/40 relative">
              <div className="flex items-center justify-between pb-3 border-b border-slate-200 mb-4">
                <span className="text-xs font-mono font-bold text-slate-700">EXTRACTED PAYLOAD</span>
                {extractedMessage && (
                  <button
                    onClick={copyExtracted}
                    className="text-xs font-mono text-indigo-600 hover:text-indigo-800 flex items-center gap-1 cursor-pointer"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                )}
              </div>

              {extractedMessage ? (
                <div className="flex flex-col gap-4">
                  <div className="p-4 rounded-xl bg-white border border-slate-200 font-mono text-xs text-slate-800 break-all leading-relaxed max-h-56 overflow-y-auto">
                    {extractedMessage}
                  </div>

                  {extractedHash && (
                    <div className="text-[10px] font-mono text-slate-400 break-all bg-slate-100 p-2 rounded-lg border border-slate-200">
                      SHA-256: <span className="text-slate-600">{extractedHash}</span>
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setExtractedMessage(null);
                      setExtractedHash(null);
                    }}
                    className="self-end px-3 py-1.5 rounded-lg bg-slate-200 hover:bg-rose-50 hover:text-rose-600 text-slate-600 font-mono text-xs font-semibold flex items-center gap-1 transition cursor-pointer"
                  >
                    <Trash2 className="w-3 h-3" />
                    WIPE FROM MEMORY
                  </button>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center text-slate-400 py-16">
                  <Lock className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs font-semibold text-slate-500">Decrypted secret will appear here</p>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
