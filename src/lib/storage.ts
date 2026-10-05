import {
  PodMetadata,
  PodFullState,
  ScratchpadData,
  VaultFileMetadata,
  Peer,
  AuditEvent,
  PodConfig,
  EphemeralLink,
  LinkBundleProfile,
} from '@/types/vault';
import { Redis } from '@upstash/redis';
import { getStore } from '@netlify/blobs';

// Ephemeral file storage in memory (buffer mapped by fileId)
interface StoredFile {
  metadata: VaultFileMetadata;
  buffer: Buffer;
}

// Global in-memory state fallback & SSE subscribers
declare global {
  // eslint-disable-next-line no-var
  var __vaultMemoryStore: Map<string, PodFullState> | undefined;
  // eslint-disable-next-line no-var
  var __vaultFileStore: Map<string, StoredFile> | undefined;
  // eslint-disable-next-line no-var
  var __vaultSubscribers: Map<string, Set<(event: { type: string; payload: unknown }) => void>> | undefined;
  // eslint-disable-next-line no-var
  var __vaultJanitorStarted: boolean | undefined;
}

const memoryStore = globalThis.__vaultMemoryStore ?? (globalThis.__vaultMemoryStore = new Map());
const fileStore = globalThis.__vaultFileStore ?? (globalThis.__vaultFileStore = new Map());
const subscribers = globalThis.__vaultSubscribers ?? (globalThis.__vaultSubscribers = new Map());

// Netlify Blobs integration (auto-detected in Netlify Functions)
function getBlobsPodStore() {
  try {
    return getStore({ name: 'auradrop-pods', consistency: 'strong' });
  } catch {
    return null;
  }
}

function getBlobsFileStore() {
  try {
    return getStore({ name: 'auradrop-files', consistency: 'strong' });
  } catch {
    return null;
  }
}

// Redis client initialization (optional; auto-detected)
let redisClient: Redis | null = null;
if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  try {
    redisClient = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    console.log('[CYPHREDROP] Upstash Redis connected successfully.');
  } catch (err) {
    console.warn('[CYPHREDROP] Failed to initialize Upstash Redis, falling back to ephemeral memory store:', err);
  }
} else {
  console.log('[CYPHREDROP] Running with Netlify Blobs & High-Performance Ephemeral Engine.');
}

/**
 * DoD 5220.22-M Zeroize Simulation
 * Overwrite memory buffer with zeros before freeing
 */
function zeroizeBuffer(buf: Buffer) {
  buf.fill(0);
}

/**
 * Active Automated Janitor / Sweeper
 * Runs continuously in the background to purge expired pods and overwrite memory buffers
 */
if (!globalThis.__vaultJanitorStarted) {
  globalThis.__vaultJanitorStarted = true;
  setInterval(async () => {
    const now = Date.now();
    for (const [podId, pod] of memoryStore.entries()) {
      // expiresAt === 0 signifies NO TIME LIMIT (Permanent Linktree/Pod)
      if ((pod.metadata.expiresAt > 0 && pod.metadata.expiresAt <= now) || pod.metadata.isZeroized) {
        console.log(`[CYPHREDROP JANITOR] TTL expired or zeroized for pod: ${podId}. Executing wipe sequence.`);
        await purgePod(podId, 'LIFECYCLE_TTL_EXPIRED');
      }
    }
  }, 10_000); // Check every 10 seconds
}

export async function createPod(config: PodConfig): Promise<PodMetadata> {
  const now = Date.now();
  const isNever = config.ttl === 'never' || config.ttlSeconds <= 0;
  const expiresAt = isNever ? 0 : now + config.ttlSeconds * 1000;

  const metadata: PodMetadata = {
    id: config.id,
    salt: config.salt,
    createdAt: now,
    expiresAt,
    ttlSeconds: isNever ? 0 : config.ttlSeconds,
    burnOnDownload: config.burnOnDownload,
    burnOnEmpty: config.burnOnEmpty,
    readOnlyGuests: config.readOnlyGuests,
    creatorPeerId: config.creatorPeerId,
    isZeroized: false,
  };

  const initialScratchpad: ScratchpadData = {
    encryptedContent: '',
    iv: '',
    version: 1,
    lastModified: now,
    modifiedBy: 'INIT',
  };

  const initialAudit: AuditEvent = {
    id: `ev-${now}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: now,
    type: 'pod_created',
    message: `Secure ephemeral pod [${config.id}] provisioned. TTL: ${config.ttl}.`,
  };

  const fullState: PodFullState = {
    metadata,
    scratchpad: initialScratchpad,
    files: [],
    peers: [],
    auditLog: [initialAudit],
    linkBundle: {
      title: `${config.id} Bundle`,
      bio: 'Self-destructing links. Private & ephemeral.',
      themeColor: '#6366F1',
      links: [],
    },
  };

  // Save to Memory
  memoryStore.set(config.id, fullState);

  // Save to Netlify Blobs if available
  const podBlobStore = getBlobsPodStore();
  if (podBlobStore) {
    try {
      await podBlobStore.setJSON(config.id, fullState);
    } catch (err) {
      console.warn('[CYPHREDROP] Netlify Blobs error on createPod:', err);
    }
  }

  // Save to Redis if configured
  if (redisClient) {
    try {
      const redisKey = `pod:${config.id}`;
      await redisClient.set(redisKey, JSON.stringify(fullState), { ex: config.ttlSeconds });
    } catch (err) {
      console.error('[VAULT-ZERO] Redis error on createPod:', err);
    }
  }

  return metadata;
}

export async function getPodState(podId: string): Promise<PodFullState | null> {
  // Check memory store
  let state = memoryStore.get(podId) || null;

  // Check Netlify Blobs
  if (!state) {
    const podBlobStore = getBlobsPodStore();
    if (podBlobStore) {
      try {
        const data = await podBlobStore.get(podId, { type: 'json' });
        if (data && typeof data === 'object') {
          state = data as PodFullState;
          memoryStore.set(podId, state);
        }
      } catch (err) {
        console.warn('[CYPHREDROP] Blobs getPodState error:', err);
      }
    }
  }

  // Fallback to Redis
  if (!state && redisClient) {
    try {
      const data = await redisClient.get<string | PodFullState>(`pod:${podId}`);
      if (data) {
        state = typeof data === 'string' ? JSON.parse(data) : data;
        if (state) {
          memoryStore.set(podId, state);
        }
      }
    } catch (err) {
      console.error('[VAULT-ZERO] Redis get error:', err);
    }
  }

  if (!state) return null;

  // Check TTL expiry (expiresAt === 0 signifies NO TIME LIMIT / permanent pod)
  if ((state.metadata.expiresAt > 0 && state.metadata.expiresAt <= Date.now()) || state.metadata.isZeroized) {
    await purgePod(podId, 'EXPIRED');
    return null;
  }

  return state;
}

export async function updateScratchpad(
  podId: string,
  scratchpad: ScratchpadData
): Promise<boolean> {
  const state = await getPodState(podId);
  if (!state || state.metadata.isZeroized) return false;

  state.scratchpad = scratchpad;
  memoryStore.set(podId, state);

  const podBlobStore = getBlobsPodStore();
  if (podBlobStore) {
    try {
      await podBlobStore.setJSON(podId, state);
    } catch (err) {
      console.warn('[CYPHREDROP] Blobs setJSON error:', err);
    }
  }

  if (redisClient) {
    try {
      const ttl = Math.max(1, Math.floor((state.metadata.expiresAt - Date.now()) / 1000));
      await redisClient.set(`pod:${podId}`, JSON.stringify(state), { ex: ttl });
    } catch (err) {
      console.error('[VAULT-ZERO] Redis error on updateScratchpad:', err);
    }
  }

  broadcast(podId, {
    type: 'scratchpad_update',
    payload: scratchpad,
  });

  return true;
}

export async function updateLinkBundle(
  podId: string,
  bundle: LinkBundleProfile,
  peerCodename: string = 'User'
): Promise<boolean> {
  const state = await getPodState(podId);
  if (!state || state.metadata.isZeroized) return false;

  state.linkBundle = bundle;

  const audit: AuditEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    type: 'link_bundle_updated',
    peerCodename,
    message: `${peerCodename} updated the link bundle (${bundle.links.length} active links).`,
  };
  state.auditLog.unshift(audit);
  if (state.auditLog.length > 50) state.auditLog.pop();

  memoryStore.set(podId, state);

  const podBlobStore = getBlobsPodStore();
  if (podBlobStore) {
    try {
      await podBlobStore.setJSON(podId, state);
    } catch (err) {
      console.warn('[CYPHREDROP] Blobs setJSON error:', err);
    }
  }

  if (redisClient) {
    try {
      const ttl = Math.max(1, Math.floor((state.metadata.expiresAt - Date.now()) / 1000));
      await redisClient.set(`pod:${podId}`, JSON.stringify(state), { ex: ttl });
    } catch (err) {
      console.error('[AURA] Redis error on updateLinkBundle:', err);
    }
  }

  broadcast(podId, {
    type: 'link_bundle_updated',
    payload: { linkBundle: bundle, audit },
  });

  return true;
}

export async function recordLinkClick(
  podId: string,
  linkId: string
): Promise<boolean> {
  const state = await getPodState(podId);
  if (!state || state.metadata.isZeroized || !state.linkBundle) return false;

  const link = state.linkBundle.links.find(l => l.id === linkId);
  if (link) {
    link.clicks = (link.clicks || 0) + 1;
    memoryStore.set(podId, state);

    broadcast(podId, {
      type: 'link_clicked',
      payload: { linkId, clicks: link.clicks },
    });
  }

  return true;
}

export async function addFile(
  podId: string,
  metadata: VaultFileMetadata,
  buffer: Buffer
): Promise<boolean> {
  let state = await getPodState(podId);
  if (!state || state.metadata.isZeroized) {
    if (!state) {
      await createPod({
        id: podId,
        salt: '00000000000000000000000000000000',
        ttl: '1h',
        ttlSeconds: 3600,
        burnOnDownload: metadata.burnOnDownload,
        burnOnEmpty: false,
        readOnlyGuests: false,
        creatorPeerId: metadata.uploadedBy,
      });
      state = await getPodState(podId);
    }
    if (!state || state.metadata.isZeroized) return false;
  }

  // Store buffer in memory
  fileStore.set(metadata.id, { metadata, buffer });

  // Store buffer in Netlify Blobs
  const fileBlobStore = getBlobsFileStore();
  if (fileBlobStore) {
    try {
      const arrayBuf = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) as ArrayBuffer;
      await fileBlobStore.set(metadata.id, arrayBuf, {
        metadata: {
          id: metadata.id,
          name: metadata.name,
          size: metadata.size,
          mimeType: metadata.mimeType,
          sha256: metadata.sha256,
          uploadedAt: metadata.uploadedAt,
          uploadedBy: metadata.uploadedBy,
          burnOnDownload: metadata.burnOnDownload,
          downloadCount: metadata.downloadCount,
        },
      });
    } catch (err) {
      console.warn('[CYPHREDROP] Netlify Blobs error on addFile:', err);
    }
  }

  // Update file list
  state.files.push(metadata);

  // Append audit event
  const audit: AuditEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    type: 'file_uploaded',
    peerCodename: metadata.uploadedBy,
    message: `Encrypted drop [${metadata.name}] sealed (${(metadata.size / 1024).toFixed(1)} KB). SHA: ${metadata.sha256.substring(0, 8)}...`,
  };
  state.auditLog.unshift(audit);
  if (state.auditLog.length > 50) state.auditLog.pop();

  memoryStore.set(podId, state);

  // Persist updated pod state to Blobs
  const podBlobStore = getBlobsPodStore();
  if (podBlobStore) {
    try {
      await podBlobStore.setJSON(podId, state);
    } catch (err) {
      console.warn('[CYPHREDROP] Blobs setJSON error:', err);
    }
  }

  if (redisClient) {
    try {
      const ttl = Math.max(1, Math.floor((state.metadata.expiresAt - Date.now()) / 1000));
      await redisClient.set(`pod:${podId}`, JSON.stringify(state), { ex: ttl });
    } catch (err) {
      console.error('[VAULT-ZERO] Redis error on addFile:', err);
    }
  }

  broadcast(podId, {
    type: 'file_added',
    payload: { file: metadata, audit },
  });

  return true;
}

export async function getFileData(fileId: string): Promise<StoredFile | null> {
  const local = fileStore.get(fileId);
  if (local) return local;

  const fileBlobStore = getBlobsFileStore();
  if (fileBlobStore) {
    try {
      const res = await fileBlobStore.getWithMetadata(fileId, { type: 'arrayBuffer' });
      if (res && res.data) {
        const meta = (res.metadata || {}) as unknown as VaultFileMetadata;
        const stored: StoredFile = {
          metadata: {
            id: meta.id || fileId,
            name: meta.name || 'encrypted.bin',
            size: meta.size || res.data.byteLength,
            mimeType: meta.mimeType || 'application/octet-stream',
            sha256: meta.sha256 || '',
            uploadedAt: meta.uploadedAt || Date.now(),
            uploadedBy: meta.uploadedBy || 'ANONYMOUS',
            downloadCount: meta.downloadCount || 0,
            burnOnDownload: meta.burnOnDownload || false,
          },
          buffer: Buffer.from(res.data),
        };
        fileStore.set(fileId, stored);
        return stored;
      }
    } catch (err) {
      console.warn('[CYPHREDROP] Blobs getFileData error:', err);
    }
  }

  return null;
}

export async function shredFile(podId: string, fileId: string, reason = 'SHRED_MANUAL'): Promise<boolean> {
  const state = await getPodState(podId);
  const stored = fileStore.get(fileId);

  if (stored) {
    zeroizeBuffer(stored.buffer);
    fileStore.delete(fileId);
  }

  const fileBlobStore = getBlobsFileStore();
  if (fileBlobStore) {
    try {
      await fileBlobStore.delete(fileId);
    } catch (err) {
      console.warn('[CYPHREDROP] Blobs delete error:', err);
    }
  }

  if (state) {
    state.files = state.files.filter(f => f.id !== fileId);

    const audit: AuditEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'file_shredded',
      message: `File [${stored?.metadata.name || fileId}] shredded from vault. (${reason})`,
    };
    state.auditLog.unshift(audit);
    if (state.auditLog.length > 50) state.auditLog.pop();

    memoryStore.set(podId, state);

    const podBlobStore = getBlobsPodStore();
    if (podBlobStore) {
      try {
        await podBlobStore.setJSON(podId, state);
      } catch (err) {
        console.warn('[CYPHREDROP] Blobs setJSON error:', err);
      }
    }

    if (redisClient) {
      try {
        const ttl = Math.max(1, Math.floor((state.metadata.expiresAt - Date.now()) / 1000));
        await redisClient.set(`pod:${podId}`, JSON.stringify(state), { ex: ttl });
      } catch (err) {
        console.error('[VAULT-ZERO] Redis error on shredFile:', err);
      }
    }

    broadcast(podId, {
      type: 'file_shredded',
      payload: { fileId, audit },
    });
  }

  return true;
}

export async function recordDownload(podId: string, fileId: string, peerCodename: string): Promise<boolean> {
  const state = await getPodState(podId);
  if (!state) return false;

  const targetFile = state.files.find(f => f.id === fileId);
  if (!targetFile) return false;

  targetFile.downloadCount++;

  const audit: AuditEvent = {
    id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    timestamp: Date.now(),
    type: 'file_downloaded',
    peerCodename,
    message: `Drop [${targetFile.name}] downloaded and decrypted by ${peerCodename}.`,
  };
  state.auditLog.unshift(audit);

  // Check Burn-on-Download conditions
  if (state.metadata.burnOnDownload || targetFile.burnOnDownload) {
    // If pod-level burn on download or file-level burn
    if (state.metadata.burnOnDownload) {
      // Burn entire pod!
      console.log(`[VAULT-ZERO] Burn-On-Download triggered for pod ${podId}! Initiating pod zeroize.`);
      await purgePod(podId, 'BURN_ON_DOWNLOAD_TRIGGERED');
      return true;
    } else {
      // Shred just this file
      console.log(`[VAULT-ZERO] Burn-On-Download shred for file ${fileId}.`);
      await shredFile(podId, fileId, 'BURN_ON_DOWNLOAD');
      return true;
    }
  }

  memoryStore.set(podId, state);
  broadcast(podId, {
    type: 'file_download_updated',
    payload: { fileId, downloadCount: targetFile.downloadCount, audit },
  });

  return true;
}

export async function addOrUpdatePeer(podId: string, peer: Peer): Promise<PodFullState | null> {
  const state = await getPodState(podId);
  if (!state || state.metadata.isZeroized) return null;

  const existingIndex = state.peers.findIndex(p => p.id === peer.id);
  let isNew = false;
  if (existingIndex >= 0) {
    state.peers[existingIndex] = { ...state.peers[existingIndex], ...peer, lastPing: Date.now() };
  } else {
    state.peers.push(peer);
    isNew = true;

    const audit: AuditEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'peer_joined',
      peerCodename: peer.codename,
      message: `Peer [${peer.codename}] established encrypted connection.`,
    };
    state.auditLog.unshift(audit);
    if (state.auditLog.length > 50) state.auditLog.pop();
  }

  // Filter out dead peers (inactive > 45 seconds)
  const now = Date.now();
  state.peers = state.peers.filter(p => now - p.lastPing < 45_000);

  memoryStore.set(podId, state);

  broadcast(podId, {
    type: isNew ? 'peer_joined' : 'peer_updated',
    payload: { peer, peers: state.peers },
  });

  return state;
}

export async function removePeer(podId: string, peerId: string): Promise<void> {
  const state = await getPodState(podId);
  if (!state) return;

  const leavingPeer = state.peers.find(p => p.id === peerId);
  state.peers = state.peers.filter(p => p.id !== peerId);

  if (leavingPeer) {
    const audit: AuditEvent = {
      id: `ev-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      timestamp: Date.now(),
      type: 'peer_left',
      peerCodename: leavingPeer.codename,
      message: `Peer [${leavingPeer.codename}] disconnected.`,
    };
    state.auditLog.unshift(audit);
    if (state.auditLog.length > 50) state.auditLog.pop();
  }

  // Check burn on empty
  if (state.metadata.burnOnEmpty && state.peers.length === 0) {
    console.log(`[VAULT-ZERO] Burn on empty triggered for pod ${podId}.`);
    await purgePod(podId, 'BURN_ON_EMPTY');
    return;
  }

  memoryStore.set(podId, state);
  broadcast(podId, {
    type: 'peer_left',
    payload: { peerId, peers: state.peers },
  });
}

/**
 * Emergency Nuke / Instant Zeroize
 * Purges memory, shreds all file buffers, deletes from Redis, and broadcasts zeroize to all peers
 */
export async function purgePod(podId: string, reason: string): Promise<boolean> {
  const state = await getPodState(podId);

  // Shred all associated files with DoD zero-fill and delete from Blobs
  if (state && state.files) {
    const fileBlobStore = getBlobsFileStore();
    for (const f of state.files) {
      const stored = fileStore.get(f.id);
      if (stored) {
        zeroizeBuffer(stored.buffer);
        fileStore.delete(f.id);
      }
      if (fileBlobStore) {
        try {
          await fileBlobStore.delete(f.id);
        } catch {}
      }
    }
  }

  // Mark state zeroized and clean from map
  if (state) {
    state.metadata.isZeroized = true;
    memoryStore.delete(podId);
  }

  // Delete from Netlify Blobs
  const podBlobStore = getBlobsPodStore();
  if (podBlobStore) {
    try {
      await podBlobStore.delete(podId);
    } catch {}
  }

  // Remove from Redis
  if (redisClient) {
    try {
      await redisClient.del(`pod:${podId}`);
    } catch (err) {
      console.error('[VAULT-ZERO] Redis del error:', err);
    }
  }

  // Broadcast ZEROIZE to all active SSE subscribers
  broadcast(podId, {
    type: 'zeroize',
    payload: { reason, timestamp: Date.now() },
  });

  // Clean subscribers
  subscribers.delete(podId);

  console.log(`[VAULT-ZERO] Pod [${podId}] successfully ZEROIZED. Reason: ${reason}.`);
  return true;
}

/**
 * SSE Real-Time PubSub Subscription
 */
export function subscribePod(
  podId: string,
  callback: (event: { type: string; payload: unknown }) => void
): () => void {
  let subSet = subscribers.get(podId);
  if (!subSet) {
    subSet = new Set();
    subscribers.set(podId, subSet);
  }
  subSet.add(callback);

  return () => {
    subSet?.delete(callback);
    if (subSet?.size === 0) {
      subscribers.delete(podId);
    }
  };
}

/**
 * Broadcast event to all connected SSE clients of a pod
 */
export function broadcast(podId: string, event: { type: string; payload: unknown }) {
  const subSet = subscribers.get(podId);
  if (!subSet) return;
  for (const cb of subSet) {
    try {
      cb(event);
    } catch (err) {
      console.error('[VAULT-ZERO] Error invoking SSE subscriber:', err);
    }
  }
}

/**
 * Admin Telemetry Aggregator for /admin command center
 */
export function getAdminTelemetry() {
  const pods: Array<{
    id: string;
    createdAt: number;
    expiresAt: number;
    ttlSeconds: number;
    burnOnDownload: boolean;
    burnOnEmpty: boolean;
    isZeroized: boolean;
    fileCount: number;
    peerCount: number;
    totalFileBytes: number;
    auditLogLength: number;
    recentAudit: AuditEvent[];
  }> = [];

  let totalFiles = 0;
  let totalFileBytes = 0;
  let totalPeers = 0;

  for (const [id, state] of memoryStore.entries()) {
    const fileCount = state.files ? state.files.length : 0;
    const peerCount = state.peers ? state.peers.length : 0;
    const fileBytes = state.files ? state.files.reduce((acc: number, f: VaultFileMetadata) => acc + (f.size || 0), 0) : 0;

    totalFiles += fileCount;
    totalFileBytes += fileBytes;
    totalPeers += peerCount;

    pods.push({
      id,
      createdAt: state.metadata.createdAt,
      expiresAt: state.metadata.expiresAt,
      ttlSeconds: state.metadata.ttlSeconds,
      burnOnDownload: state.metadata.burnOnDownload,
      burnOnEmpty: state.metadata.burnOnEmpty,
      isZeroized: state.metadata.isZeroized,
      fileCount,
      peerCount,
      totalFileBytes: fileBytes,
      auditLogLength: state.auditLog ? state.auditLog.length : 0,
      recentAudit: state.auditLog ? state.auditLog.slice(0, 5) : [],
    });
  }

  const mem = process.memoryUsage();

  return {
    activePodCount: memoryStore.size,
    activeFileCount: fileStore.size,
    totalFiles,
    totalFileBytes,
    totalPeers,
    pods,
    memoryUsage: {
      rss: mem.rss,
      heapTotal: mem.heapTotal,
      heapUsed: mem.heapUsed,
      external: mem.external,
    },
    janitorRunning: Boolean(globalThis.__vaultJanitorStarted),
  };
}

/**
 * Force manual janitor sweep
 */
export async function forceJanitorSweep(): Promise<{ sweptPods: string[] }> {
  const now = Date.now();
  const sweptPods: string[] = [];
  for (const [podId, pod] of memoryStore.entries()) {
    if ((pod.metadata.expiresAt > 0 && pod.metadata.expiresAt <= now) || pod.metadata.isZeroized) {
      sweptPods.push(podId);
      await purgePod(podId, 'ADMIN_FORCE_JANITOR_SWEEP');
    }
  }
  return { sweptPods };
}

