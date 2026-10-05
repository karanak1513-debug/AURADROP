# AURA DROP — Engineering Rules, Security Invariants & Coding Standards

**Document Version:** 2.0.0  
**Status:** Mandatory Enforcement  
**Scope:** All Engineers, Contributors, and Autonomous Agents  

---

## 1. Non-Negotiable Security Invariants

These five architectural rules are **immutable**. Any pull request or code change that violates these rules must be rejected immediately without exception.

### 🔒 Invariant 1: The Rule of the URL Fragment (`#key=...`)
- **Rule:** The room decryption key or passphrase **MUST NEVER** be passed via URL query parameters (`?key=...`), request path segments (`/pod/[id]/[key]`), HTTP headers, or request bodies.
- **Enforcement:** The key must reside strictly after the `#` hash fragment (`#key=...`). Under RFC 3986, the fragment is client-only and is never transmitted by compliant user agents over HTTP/HTTPS.
- **Lint Check:** Grep tests must reject any code sending `window.location.hash` or decoded key strings in `fetch()`, `XMLHttpRequest`, or `WebSocket` payloads.

### 🛡️ Invariant 2: Client-Side Cryptographic Boundary
- **Rule:** Plaintext files, plaintext scratchpad content, and user messages must **NEVER** leave the browser unencrypted.
- **Enforcement:** All text and binary data must be passed through `crypto.subtle.encrypt` (AES-256-GCM) with a unique 12-byte IV prior to network transmission.
- **Server Role:** The backend is an untrusted blind relay. If the server receives unencrypted JSON payloads for file content or scratchpad text, it is considered a critical security failure.

### 🚫 Invariant 3: Zero Telemetry & Zero Persistent Identifiers
- **Rule:** Absolute prohibition against third-party analytics, user tracking, fingerprinting scripts, external fonts loaded at runtime, or persistent identifiers.
- **Enforcement:**
  - No Google Analytics, PostHog, Mixpanel, Sentry, Datadog, or external advertising SDKs.
  - No `Set-Cookie` headers for tracking or authentication.
  - No persistent `localStorage` of keys or file contents across sessions.
  - No logging of client IP addresses or User-Agent headers in server logs.

### ⏳ Invariant 4: Absolute Ephemeral Lifecycle (DoD 5220.22-M Zeroize)
- **Rule:** All data exists under a strict Time-To-Live constraint (`15m`, `1h`, `6h`, `24h`). Once expired or manually purged, data must be irreversibly obliterated.
- **Enforcement:**
  - The in-memory buffer must be explicitly wiped using `buffer.fill(0)` before deletion.
  - Purged pods must not be retained in database tombstones or soft-delete states.
  - Deletion signals must cascade immediately to all connected clients via SSE.

### 🧹 Invariant 5: In-Browser Memory Sanitization (`wipeMemory`)
- **Rule:** Cryptographic key objects, decrypted byte arrays, and sensitive buffers in the browser must be actively overwritten before dereferencing.
- **Enforcement:** Components handling decrypted files or keys must invoke `wipeMemory(buffer)` in `useEffect` cleanup return functions or unmount hooks:
```typescript
export function wipeMemory(buffer: Uint8Array | ArrayBuffer | null) {
  if (!buffer) return;
  if (buffer instanceof Uint8Array) {
    buffer.fill(0);
  } else if (buffer instanceof ArrayBuffer) {
    new Uint8Array(buffer).fill(0);
  }
}
```

---

## 2. Frontend & Aesthetic Directives

### 2.1 "Aura Drop" Design Tokens
- **Background Palette:** `#F8FAFC` (Alabaster / Milk White) with dual ambient radial glows in `#E0F2FE` (Pastel Blue) and `#EDE9FE` (Soft Lavender).
- **Glassmorphism Spec:**
  - Standard Card: `bg-white/70 backdrop-blur-3xl border border-white/90 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]`
  - High-Translucency Modal: `bg-white/80 backdrop-blur-3xl border border-white/95 shadow-2xl`
- **Typography:**
  - Display & Body: Modern grotesque (`Inter`, `Plus Jakarta Sans`, or `system-ui`).
  - Hashes & Keys: Precision monospace (`Geist Mono`, `ui-monospace`, `SFMono-Regular`).
- **Accent Primaries:**
  - Electric Indigo (`#6366F1`)
  - Opal Cyan (`#06B6D4`)
  - Amber (`#F59E0B`) to Coral (`#F43F5E`) exclusively for critical warning and destruction states.

### 2.2 Motion Framework Rules (`framer-motion`)
- **Spring Standards:** All layout and modal animations must use physics-based springs:
```typescript
transition: { type: 'spring', stiffness: 300, damping: 30 }
```
- **Tactile Drag Feedback:** Drag-and-drop targets must provide visual feedback:
```typescript
whileHover={{ scale: 1.01 }}
whileTap={{ scale: 0.98 }}
```
- **Destruction Animations:** Exit animations for deleted files must use swift collapse transitions (`duration: 0.2s`, `opacity: 0`, `scale: 0.95`).

---

## 3. WebGL & Three.js Performance Standards

1. **Avoid Deprecated Three.js APIs:**
   - **Do NOT** instantiate `new THREE.Clock()`. In Three.js v0.170+, `Clock` is deprecated. Use `performance.now()` or `THREE.Timer` instead.
2. **Resource Disposal:**
   - Geometries, materials, and textures must be disposed in the canvas teardown:
   ```typescript
   geometry.dispose();
   material.dispose();
   renderer.dispose();
   ```
3. **Frame-Rate Stability:**
   - Mouse parallax must use lerped coordinates rather than setting camera positions directly on `mousemove`.
   - The scene must maintain a target rate of 60fps on modern integrated GPUs.

---

## 4. Backend & API Route Guidelines

1. **Edge-Compatibility:** All API route handlers must be compatible with Node.js and Edge runtimes. Avoid unmanaged native C++ bindings.
2. **Content-Length & Stream Safety:** File upload endpoints must validate payload sizes client-side (max recommended 50MB for transient memory pods) to prevent server OOM conditions.
3. **No Unhandled Promises in SSE:** When writing to Server-Sent Event response streams (`TransformStream`), catch client abort errors gracefully:
```typescript
writer.write(encoder.encode(`data: ${JSON.stringify(event)}\n\n`)).catch(() => {
  // Client disconnected cleanly
});
```

---

## 5. Development & Deployment Rules (Windows / Node Gotchas)

1. **Npm Scripts Restriction (`--ignore-scripts`):** If the environment specifies `allow-scripts` restrictions in `~/.npmrc`, always run `npm install <pkg> --ignore-scripts` to avoid `EALLOWSCRIPTS` errors.
2. **Windows Shell Command Escaping:** Avoid complex nested PowerShell JSON quoting when running curl commands; use Node.js one-liners (`node -e "..."`) for reliable cross-platform API testing.
3. **Workspace Path Handling:** Always accommodate folder names with spaces (e.g., `MY OWN BACKEND`) by properly quoting paths in build scripts.
