import { LucideIcon } from 'lucide-react';

export type PodTTL = '15m' | '1h' | '6h' | '24h';

export interface PodConfig {
  id: string;
  salt: string;
  ttl: PodTTL;
  ttlSeconds: number;
  burnOnDownload: boolean;
  burnOnEmpty: boolean;
  readOnlyGuests: boolean;
  creatorPeerId: string;
}

export interface PodMetadata {
  id: string;
  salt: string;
  createdAt: number;
  expiresAt: number;
  ttlSeconds: number;
  burnOnDownload: boolean;
  burnOnEmpty: boolean;
  readOnlyGuests: boolean;
  creatorPeerId: string;
  isZeroized: boolean;
}

export interface EncryptedFileRecord {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  uploadedAt: number;
  uploadedBy: string;
  sha256: string;
  iv: string;
  encryptedBlobUrl?: string;
  dataBuffer?: string; // Base64 encoded encrypted payload for in-memory storage
  downloadCount: number;
}

export interface ScratchpadData {
  encryptedContent: string;
  iv: string;
  version: number;
  lastModified: number;
  modifiedBy: string;
}

export interface PeerInfo {
  peerId: string;
  displayName: string;
  avatarSeed: string;
  joinedAt: number;
  lastActive: number;
  isHost: boolean;
}

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: 'pod_created' | 'peer_joined' | 'peer_left' | 'file_uploaded' | 'file_downloaded' | 'file_purged' | 'scratchpad_updated' | 'zeroize_triggered' | 'tool_executed' | 'workflow_completed';
  message: string;
  peerId?: string;
  metadata?: Record<string, unknown>;
}

export interface ChatMessage {
  id: string;
  senderId: string;
  senderName: string;
  encryptedPayload: string;
  iv: string;
  timestamp: number;
}

export interface PodFullState {
  metadata: PodMetadata;
  scratchpad: ScratchpadData;
  files: EncryptedFileRecord[];
  peers: PeerInfo[];
  auditLog: AuditEvent[];
}

/* =========================================================================
   STUDIO: 32 CLIENT-SIDE PDF & DOCUMENT TOOLS
   ========================================================================= */

export type ToolCategory = 'core' | 'convert' | 'security' | 'advanced' | 'ai';

export type ToolInputType = 'pdf' | 'multiple-pdf' | 'images' | 'office' | 'any' | 'none';

export type ToolId =
  // A. Core Manipulation (7)
  | 'merge-pdf'
  | 'split-pdf'
  | 'organize-pdf'
  | 'rotate-pdf'
  | 'crop-pdf'
  | 'page-numbers'
  | 'watermark-pdf'
  // B. Image & Document Conversions (10)
  | 'jpg-to-pdf'
  | 'pdf-to-jpg'
  | 'pdf-to-markdown'
  | 'html-to-pdf'
  | 'pdf-to-word'
  | 'word-to-pdf'
  | 'pdf-to-excel'
  | 'excel-to-pdf'
  | 'pdf-to-pptx'
  | 'pptx-to-pdf'
  // C. Security & Forensic Tools (7)
  | 'protect-pdf'
  | 'unlock-pdf'
  | 'redact-pdf'
  | 'sign-pdf'
  | 'pdf-to-pdfa'
  | 'repair-pdf'
  | 'compare-pdf'
  // D. Advanced Optimization & Interactive Forms (4)
  | 'compress-pdf'
  | 'forms-builder'
  | 'scan-to-pdf'
  | 'flatten-pdf'
  // E. AI & Language Intelligence (4)
  | 'ocr-pdf'
  | 'ai-summarizer'
  | 'translate-pdf'
  | 'extract-assets';

export interface StudioToolDefinition {
  id: ToolId;
  title: string;
  description: string;
  category: ToolCategory;
  inputType: ToolInputType;
  outputFormat: string;
  badge?: string;
  iconName: string;
  tags: string[];
}

export interface ToolExecutionResult {
  success: boolean;
  title: string;
  filename: string;
  blob?: Blob;
  dataUrl?: string;
  textPayload?: string;
  extractedFiles?: Array<{ name: string; blob: Blob; size: number }>;
  metadata?: Record<string, unknown>;
  error?: string;
}

/* =========================================================================
   WORKFLOW AUTOMATION ENGINE
   ========================================================================= */

export interface WorkflowStep {
  id: string;
  toolId: ToolId;
  label: string;
  params: Record<string, any>;
  status: 'idle' | 'running' | 'completed' | 'error';
  progress?: number;
  output?: ToolExecutionResult;
  error?: string;
}

export interface WorkflowPreset {
  id: string;
  name: string;
  description: string;
  icon: string;
  tags: string[];
  steps: Array<{
    toolId: ToolId;
    label: string;
    params?: Record<string, any>;
  }>;
}
