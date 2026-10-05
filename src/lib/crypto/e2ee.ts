/**
 * AURA DROP Zero-Knowledge Cryptographic Engine
 * 100% In-Browser Web Crypto API Execution (AES-256-GCM + PBKDF2 100,000 rounds)
 * URL Fragment isolation (#key=...) ensures the decryption secret never touches server HTTP logs.
 */

const PBKDF2_ROUNDS = 100_000;
const AES_KEY_LENGTH = 256;
const IV_LENGTH = 12; // 96-bit IV recommended for AES-GCM

export function generatePodSecret(): string {
  const bytes = new Uint8Array(32); // 256 bits of entropy
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

export function generateSalt(): string {
  const salt = new Uint8Array(16);
  crypto.getRandomValues(salt);
  return btoa(String.fromCharCode(...salt));
}

export async function deriveKey(passphrase: string, saltBase64: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  const rawKeyMaterial = enc.encode(passphrase);
  const saltBytes = Uint8Array.from(atob(saltBase64), c => c.charCodeAt(0));

  const baseKey = await crypto.subtle.importKey(
    'raw',
    rawKeyMaterial,
    { name: 'PBKDF2' },
    false,
    ['deriveKey']
  );

  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ROUNDS,
      hash: 'SHA-256',
    },
    baseKey,
    { name: 'AES-GCM', length: AES_KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptText(
  plaintext: string,
  key: CryptoKey
): Promise<{ ciphertext: string; iv: string }> {
  const enc = new TextEncoder();
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encoded = enc.encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encoded
  );

  return {
    ciphertext: btoa(String.fromCharCode(...new Uint8Array(encryptedBuffer))),
    iv: btoa(String.fromCharCode(...iv)),
  };
}

export async function decryptText(
  ciphertextBase64: string,
  ivBase64: string,
  key: CryptoKey
): Promise<string> {
  const dec = new TextDecoder();
  const ciphertextBytes = Uint8Array.from(atob(ciphertextBase64), c => c.charCodeAt(0));
  const ivBytes = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));

  const decryptedBuffer = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    ciphertextBytes
  );

  return dec.decode(decryptedBuffer);
}

export async function encryptBinary(
  data: ArrayBuffer,
  key: CryptoKey
): Promise<{ encryptedBlob: Blob; iv: string; sha256: string }> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));

  // Compute SHA-256 hash of original unencrypted plaintext
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const sha256 = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    data
  );

  return {
    encryptedBlob: new Blob([encryptedBuffer], { type: 'application/octet-stream' }),
    iv: btoa(String.fromCharCode(...iv)),
    sha256,
  };
}

export async function decryptBinary(
  encryptedData: ArrayBuffer,
  ivBase64: string,
  key: CryptoKey
): Promise<ArrayBuffer> {
  const ivBytes = Uint8Array.from(atob(ivBase64), c => c.charCodeAt(0));
  return crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ivBytes },
    key,
    encryptedData
  );
}

export async function calculateSha256(data: ArrayBuffer): Promise<string> {
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hashBuffer))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Multi-pass zero-fill memory wipe (DoD 5220.22-M simulation)
 */
export function wipeMemory(buffer: Uint8Array | ArrayBufferView): void {
  if (ArrayBuffer.isView(buffer)) {
    const uint8 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    uint8.fill(0x00);
    uint8.fill(0xff);
    uint8.fill(0x00);
  }
}
