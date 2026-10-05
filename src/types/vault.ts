export type PodTTL = '15m' | '1h' | '6h' | '24h' | 'never';

export interface PodConfig {
  id: string;
  salt: string; // Base64 encoded PBKDF2 salt
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

export interface EncryptedPayload {
  ciphertext: string; // Base64
  iv: string; // Base64
}

export interface ScratchpadData {
  encryptedContent: string;
  iv: string;
  version: number;
  lastModified: number;
  modifiedBy: string; // Peer codename
}

export interface VaultFileMetadata {
  id: string;
  name: string; // Display name (can also be encrypted)
  size: number;
  mimeType: string;
  sha256: string;
  uploadedAt: number;
  uploadedBy: string; // Peer codename
  downloadCount: number;
  burnOnDownload: boolean;
}

export interface Peer {
  id: string;
  codename: string;
  color: string;
  joinedAt: number;
  lastPing: number;
  isCreator: boolean;
  cursorLine?: number;
  cursorCol?: number;
}

export type LinkCategory =
  | 'website'
  | 'github'
  | 'figma'
  | 'document'
  | 'social'
  | 'media'
  | 'crypto'
  | 'custom';

export interface EphemeralLink {
  id: string;
  title: string;
  url: string;
  category: LinkCategory;
  description?: string;
  tag?: string;
  clicks: number;
  addedBy: string;
  addedAt: number;
}

export interface LinkBundleProfile {
  title: string;
  bio: string;
  customName?: string;
  avatarIcon?: string;
  themeColor: string;
  qrColor?: string;
  links: EphemeralLink[];
}

export type AuditEventType =
  | 'pod_created'
  | 'peer_joined'
  | 'peer_left'
  | 'scratchpad_updated'
  | 'file_uploaded'
  | 'file_downloaded'
  | 'file_shredded'
  | 'burn_triggered'
  | 'zeroize_initiated'
  | 'timer_warning'
  | 'link_added'
  | 'link_removed'
  | 'link_clicked'
  | 'link_bundle_updated';

export interface AuditEvent {
  id: string;
  timestamp: number;
  type: AuditEventType;
  peerId?: string;
  peerCodename?: string;
  message: string;
}

export interface TacticalMessage {
  id: string;
  timestamp: number;
  senderId: string;
  senderCodename: string;
  senderColor: string;
  encryptedText: string;
  iv: string;
}

export interface PodFullState {
  metadata: PodMetadata;
  scratchpad: ScratchpadData;
  files: VaultFileMetadata[];
  peers: Peer[];
  auditLog: AuditEvent[];
  linkBundle?: LinkBundleProfile;
}
