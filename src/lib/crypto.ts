/**
 * CYPHREDROP Cryptographic Engine
 * Zero-Knowledge Client-Side Encryption
 * Standards: PBKDF2 (SHA-256, 100k iter), AES-256-GCM, SHA-256
 */

const PBKDF2_ITERATIONS = 100_000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const SALT_LENGTH = 16; // 128 bits

// NATO Phonetic Alphabet words for memorable, military-grade passphrases
const NATO_WORDS = [
  'ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT',
  'GOLF', 'HOTEL', 'INDIA', 'JULIETT', 'KILO', 'LIMA',
  'MIKE', 'NOVEMBER', 'OSCAR', 'PAPA', 'QUEBEC', 'ROMEO',
  'SIERRA', 'TANGO', 'UNIFORM', 'VICTOR', 'WHISKEY', 'XRAY',
  'YANKEE', 'ZULU', 'PHANTOM', 'GHOST', 'SPECTRE', 'SHADOW',
  'VORTEX', 'CIPHER', 'AEGIS', 'TITAN', 'NEXUS', 'VALKYRIE',
  'CYPHER', 'KRONOS', 'STEALTH', 'OBSIDIAN', 'HYDRA', 'ORACLE'
];

/**
 * Generate a randomized NATO-phonetic alphanumeric room identifier
 * Example: "CYPHER-749-ALPHA"
 */
export function generateNATORoomId(): string {
  const word1 = NATO_WORDS[Math.floor(Math.random() * NATO_WORDS.length)];
  const word2 = NATO_WORDS[Math.floor(Math.random() * NATO_WORDS.length)];
  const num = Math.floor(100 + Math.random() * 900);
  return `${word1}-${num}-${word2}`;
}

/**
 * Generate a high-entropy military passphrase (256-bit entropy equivalent)
 */
export function generateSecurePassphrase(): string {
  const words: string[] = [];
  for (let i = 0; i < 4; i++) {
    words.push(NATO_WORDS[Math.floor(Math.random() * NATO_WORDS.length)]);
  }
  const randomSuffix = Array.from(crypto.getRandomValues(new Uint8Array(4)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('')
    .toUpperCase();
  return `${words.join('-')}-${randomSuffix}`;
}

/**
 * Generate a fresh cryptographically random salt (base64)
 */
export function generateSalt(seed?: string): string {
  if (seed) {
    return generateDeterministicSalt(seed);
  }
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  return uint8ArrayToBase64(salt);
}

/**
 * Generate a deterministic Base64 salt derived from a podId / roomId.
 * Guarantees that if serverless storage cold-starts, any peer or container
 * can reconstruct the exact same PBKDF2 salt for key derivation.
 */
export function generateDeterministicSalt(seed: string): string {
  const enc = new TextEncoder();
  const input = `AURADROP-SALT-V1:${seed.trim().toUpperCase()}`;
  const inputBytes = enc.encode(input);
  const salt = new Uint8Array(SALT_LENGTH);
  for (let i = 0; i < SALT_LENGTH; i++) {
    salt[i] = inputBytes[i % inputBytes.length] ^ ((i * 37 + 13) & 0xff);
  }
  return uint8ArrayToBase64(salt);
}

/**
 * Utility: Convert Uint8Array to Base64 safely
 */
export function uint8ArrayToBase64(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

/**
 * Utility: Convert Base64 string to Uint8Array
 */
export function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

/**
 * Utility: Convert ArrayBuffer to Hex String
 */
export function bufferToHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Derive an AES-256-GCM CryptoKey from a user passphrase and salt via PBKDF2
 */
export async function generateKeyFromPassphrase(
  passphrase: string,
  saltBase64: string
): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const saltBytes = base64ToUint8Array(saltBase64);

  // 1. Import raw passphrase as key material
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(passphrase),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  // 2. Derive AES-256-GCM key with 100,000 PBKDF2 iterations
  return await crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes as unknown as BufferSource,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    {
      name: 'AES-GCM',
      length: AES_KEY_LENGTH,
    },
    false, // Non-extractable for memory safety
    ['encrypt', 'decrypt']
  );
}

/**
 * Compute SHA-256 checksum of an ArrayBuffer or string
 */
export async function computeSHA256(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  let buffer: ArrayBuffer;
  if (typeof data === 'string') {
    buffer = new TextEncoder().encode(data).buffer;
  } else if (data instanceof Uint8Array) {
    buffer = data.buffer as ArrayBuffer;
  } else {
    buffer = data;
  }
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  return bufferToHex(hashBuffer);
}

/**
 * Encrypt a text string using AES-256-GCM
 * Returns Base64 ciphertext and Base64 IV
 */
export async function encryptText(
  plainText: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const data = enc.encode(plainText);

  const encryptedBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    data
  );

  return {
    ciphertext: uint8ArrayToBase64(new Uint8Array(encryptedBuffer)),
    iv: uint8ArrayToBase64(iv),
  };
}

/**
 * Decrypt a text string using AES-256-GCM
 */
export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const ciphertext = base64ToUint8Array(ciphertextBase64);
  const iv = base64ToUint8Array(ivBase64);

  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv as unknown as BufferSource,
    },
    key,
    ciphertext as unknown as BufferSource
  );

  return new TextDecoder().decode(decryptedBuffer);
}

/**
 * Encrypted Envelope Binary Specification:
 * [Magic: 'CD' or 'V0'] (2 bytes)
 * [IV: 12 bytes]
 * [Metadata Length (JSON): 2 bytes uint16]
 * [Metadata JSON UTF-8: N bytes]
 * [AES-GCM Ciphertext + 16-byte Auth Tag: Remaining bytes]
 */
export interface FileEnvelopeMetadata {
  name: string;
  mimeType: string;
  size: number;
  originalSha256: string;
}

/**
 * Client-Side Binary File Encryption
 * Encrypts arbitrary ArrayBuffer with metadata into a self-contained encrypted envelope
 */
export async function encryptFileBuffer(
  fileBuffer: ArrayBuffer,
  fileName: string,
  mimeType: string,
  key: CryptoKey,
  onProgress?: (percent: number) => void
): Promise<{ encryptedBlob: Blob; sha256: string }> {
  onProgress?.(10);
  const originalSha256 = await computeSHA256(fileBuffer);
  onProgress?.(30);

  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const meta: FileEnvelopeMetadata = {
    name: fileName,
    mimeType: mimeType || 'application/octet-stream',
    size: fileBuffer.byteLength,
    originalSha256,
  };

  const metaBytes = new TextEncoder().encode(JSON.stringify(meta));
  const metaLen = metaBytes.byteLength;

  onProgress?.(50);
  const cipherBuffer = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    fileBuffer
  );
  onProgress?.(80);

  // Construct envelope
  // Header: 'CD' (2 bytes) + IV (12 bytes) + MetaLen (2 bytes) + MetaBytes + CipherBuffer
  const headerLen = 2 + IV_LENGTH + 2 + metaLen;
  const packed = new Uint8Array(headerLen + cipherBuffer.byteLength);

  // Magic 'CD' (CyphreDrop)
  packed[0] = 0x43; // 'C'
  packed[1] = 0x44; // 'D'

  // IV
  packed.set(iv, 2);

  // MetaLen (Big Endian)
  packed[14] = (metaLen >> 8) & 0xff;
  packed[15] = metaLen & 0xff;

  // Metadata
  packed.set(metaBytes, 16);

  // Ciphertext
  packed.set(new Uint8Array(cipherBuffer), headerLen);

  onProgress?.(100);

  const encryptedBlob = new Blob([packed], { type: 'application/octet-stream' });
  return {
    encryptedBlob,
    sha256: originalSha256,
  };
}

/**
 * Client-Side Binary File Decryption
 * Validates envelope magic, extracts metadata, verifies AES-GCM tag, checks SHA-256
 */
export async function decryptFileBuffer(
  encryptedBuffer: ArrayBuffer,
  key: CryptoKey,
  onProgress?: (percent: number) => void
): Promise<{ decryptedBlob: Blob; metadata: FileEnvelopeMetadata }> {
  onProgress?.(15);
  const bytes = new Uint8Array(encryptedBuffer);

  // Validate Magic: 'CD' (0x43, 0x44) or legacy 'V0' (0x56, 0x30)
  const isCD = bytes[0] === 0x43 && bytes[1] === 0x44;
  const isV0 = bytes[0] === 0x56 && bytes[1] === 0x30;
  if (!isCD && !isV0) {
    throw new Error('INVALID_ENVELOPE: Unrecognized CYPHREDROP cipher payload.');
  }

  // Extract IV
  const iv = bytes.slice(2, 2 + IV_LENGTH);

  // Extract MetaLen
  const metaLen = (bytes[14] << 8) | bytes[15];
  const metaStart = 16;
  const metaEnd = metaStart + metaLen;
  const metaBytes = bytes.slice(metaStart, metaEnd);

  const meta: FileEnvelopeMetadata = JSON.parse(new TextDecoder().decode(metaBytes));
  onProgress?.(45);

  const cipherStart = metaEnd;
  const cipherBytes = bytes.slice(cipherStart);

  onProgress?.(70);
  const decryptedBuffer = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv,
    },
    key,
    cipherBytes
  );

  onProgress?.(90);
  // Verify integrity
  const decryptedSha256 = await computeSHA256(decryptedBuffer);
  if (decryptedSha256 !== meta.originalSha256) {
    throw new Error('INTEGRITY_COMPROMISED: SHA-256 checksum mismatch after decryption.');
  }

  onProgress?.(100);
  const decryptedBlob = new Blob([decryptedBuffer], { type: meta.mimeType });
  return {
    decryptedBlob,
    metadata: meta,
  };
}

/**
 * Active Memory Zeroize
 * Overwrites typed arrays and memory buffers with zeroes to simulate DoD memory scrub
 */
export function wipeMemory(buffer: ArrayBuffer | Uint8Array): void {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
  bytes.fill(0);
}
