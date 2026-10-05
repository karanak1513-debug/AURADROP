# AURA DROP — Engineering Tasks, Roadmap & Verification Matrix

**Document Version:** 2.0.0  
**Status:** In Progress / Active Execution  
**Project Lead:** Principal Software Architect & Lead Security Engineer  

---

## 1. Roadmap & Implementation Phases

```mermaid
gantt
    title AURA DROP Implementation Roadmap
    dateFormat  YYYY-MM-DD
    section Phase 1: Crypto & Storage
    Web Crypto Engine & PBKDF2/AES-GCM   :done, p1_1, 2026-10-01, 2d
    In-Memory Ephemeral Engine & Janitor :done, p1_2, 2026-10-02, 2d
    section Phase 2: API & Architecture
    Next.js App Router & SSE Stream      :done, p2_1, 2026-10-03, 1d
    Encrypted Blob Endpoints & Shredder  :done, p2_2, 2026-10-03, 1d
    section Phase 3: "Aura Drop" Redesign
    Alabaster & Glassmorphism System     :done, p3_1, 2026-10-04, 1d
    Workspace HUD & Luminous Scratchpad  :done, p3_2, 2026-10-04, 1d
    The Ingestion Vault & Tactical Chat  :done, p3_3, 2026-10-04, 1d
    section Phase 4: 3D WebGL Canvas
    Three.js Refractive Glass Shapes     :done, p4_1, 2026-10-04, 1d
    Mouse Parallax & Particle Explosion  :done, p4_2, 2026-10-04, 1d
    section Phase 5: Documentation Suite
    PRD, Architecture, Rules, Design     :done, p5_1, 2026-10-04, 1d
    Tasks, Memory & Verification Matrix  :active, p5_2, 2026-10-04, 1d
    section Phase 6: Cloud & P2P
    Upstash Redis Cloud Production Tier  :planned, p6_1, 2026-10-05, 3d
    Cloudflare R2 Object Storage Adapter :planned, p6_2, 2026-10-08, 3d
    WebRTC P2P DataChannels Direct Sync  :planned, p6_3, 2026-10-11, 4d
```

---

## 2. Granular Task Breakdown & Execution Status

### Phase 1: Cryptographic Engine & Ephemeral Store (COMPLETED)
- [x] **TASK-101:** Implement `src/lib/crypto.ts` with PBKDF2 (100k rounds SHA-256) and AES-256-GCM.
- [x] **TASK-102:** Implement structured binary envelope packer/unpacker (`CD01` magic header + 12B IV).
- [x] **TASK-103:** Implement NATO phonetic room identifier and 256-bit passphrase generators.
- [x] **TASK-104:** Implement `wipeMemory()` utility for in-browser zero-fill sanitization.
- [x] **TASK-105:** Implement `src/lib/storage.ts` in-memory store with `Buffer.fill(0)` DoD zero-fill simulation.
- [x] **TASK-106:** Implement 10-second background automated janitor sweeper for TTL expiration.

### Phase 2: Next.js API Routes & SSE Sync (COMPLETED)
- [x] **TASK-201:** Build `POST /api/pods` for room provisioning with salt and TTL parameters.
- [x] **TASK-202:** Build `GET /api/pods/[id]` for room metadata retrieval and validation.
- [x] **TASK-203:** Build `POST /api/pods/[id]` for panic kill-switch zeroize trigger.
- [x] **TASK-204:** Build `GET /api/pods/[id]/stream` for Server-Sent Events (SSE) live synchronization.
- [x] **TASK-205:** Build `POST /api/pods/[id]/events` for transient peer broadcast messages.
- [x] **TASK-206:** Build `POST /api/pods/[id]/files` for encrypted binary blob dispatch.
- [x] **TASK-207:** Build `GET /api/pods/[id]/files/[fileId]` with Burn-on-Download support.

### Phase 3: "Aura Drop" Luxury Light Theme Design System (COMPLETED)
- [x] **TASK-301:** Update `src/app/globals.css` with Alabaster `#F8FAFC` base, pastel blue/lavender radial ambient glows, and luxury glassmorphism tokens.
- [x] **TASK-302:** Redesign `src/components/layout/Navbar.tsx` into a floating pill-shaped frosted glass header with edge latency badge and quick purge trigger.
- [x] **TASK-303:** Redesign `src/components/landing/LandingHub.tsx` with segmented TTL selector (`15m`, `1h`, `6h`, `24h`), OPSEC toggles, and direct room join card.
- [x] **TASK-304:** Redesign `src/components/workspace/WorkspaceHUD.tsx` with dynamic SVG circular timer, active peer rings, and mobile QR sync modal.
- [x] **TASK-305:** Streamline workspace architecture to dedicate the primary interface exclusively to "The Ingestion Vault", removing the scratchpad tab and editor.
- [x] **TASK-306:** Redesign `src/components/workspace/DeadDropVault.tsx` ("The Ingestion Vault") with tactile drag-and-drop zone (`scale: 1.02`), SHA-256 fingerprint badges, and single-click "Vaporize" button.
- [x] **TASK-307:** Redesign `src/components/workspace/TacticalSignalStream.tsx` with iridescent transient message bubbles and real-time security audit trail.
- [x] **TASK-308:** Redesign `src/components/workspace/ZeroizeOverlay.tsx` with 5-stage memory decontamination checklist and sound burst.

### Phase 4: 3D WebGL Canvas & Particle Vaporization (COMPLETED)
- [x] **TASK-401:** Implement `src/components/canvas/AuraCanvas.tsx` using Three.js and `@react-three/fiber`.
- [x] **TASK-402:** Render 5 physical glass geometries (Torus, Icosahedron Gem, Sphere, Octahedron, Ring) with transmission ($0.94$) and IOR ($1.52$).
- [x] **TASK-403:** Implement mouse parallax with velocity dampening (`lerp factor: 0.04`).
- [x] **TASK-404:** Implement 1,200 particle vaporization explosion sequence triggered on pod purge/zeroize.
- [x] **TASK-405:** Replace deprecated `THREE.Clock` with `performance.now()` to eliminate console warnings.

### Phase 5: Comprehensive Documentation Suite (`/docs`) (IN PROGRESS)
- [x] **TASK-501:** Create `docs/PRD.md` (Product Requirements Document).
- [x] **TASK-502:** Create `docs/ARCHITECTURE.md` (System Architecture & Security Model).
- [x] **TASK-503:** Create `docs/RULES.md` (Engineering Guidelines & Zero-Knowledge Invariants).
- [x] **TASK-504:** Create `docs/DESIGN.md` (Aura Drop Design System & 3D WebGL Spec).
- [x] **TASK-505:** Create `docs/TASKS.md` (Roadmap, Task Matrix & Verification Plan).
- [x] **TASK-506:** Create `docs/MEMORY.md` (ADRs, Known Gotchas, & Environment Context).

### Phase 7: Ephemeral Linktree & Smart QR Bundle Engine (COMPLETED)
- [x] **TASK-701:** Add `LinkCategory`, `EphemeralLink`, `LinkBundleProfile` to `src/types/vault.ts`.
- [x] **TASK-702:** Implement in-memory link bundle persistence, click counter updater, and SSE broadcast in `src/lib/storage.ts`.
- [x] **TASK-703:** Implement `link_bundle_updated` and `link_clicked` event dispatchers in `src/app/api/pods/[id]/events/route.ts`.
- [x] **TASK-704:** Build `src/components/workspace/SmartLinktreeVault.tsx` with category selection, 6 theme palettes, interactive iPhone mockup preview, and dynamic QR generator with PNG download.
- [x] **TASK-705:** Wire dual tab navigation (`Shared Files` vs `Smart QR & Linktree`) in `src/app/pod/[id]/page.tsx` and integrate fast shortcuts in `src/components/workspace/WorkspaceHUD.tsx`.

### Phase 8: 1-Tap Social Sharing & Seamless Auto-Join Link (COMPLETED)
- [x] **TASK-801:** Build `src/components/workspace/SocialShareModal.tsx` with WhatsApp, Telegram, Instagram, and Web Share API integrations.
- [x] **TASK-802:** Implement resilient auto-join key extraction supporting both `#key=` hash fragments and `?key=` search parameters with instant URL sanitization in `src/app/pod/[id]/page.tsx`.
- [x] **TASK-803:** Add auto-join detection and deep URL parsing in `src/components/landing/LandingHub.tsx` (`?join=...&key=...`).
- [x] **TASK-804:** Add 1-Tap Share buttons to `src/components/workspace/WorkspaceHUD.tsx` action bar, QR modal, and `src/components/layout/Navbar.tsx` credentials flyout.

### Phase 9: Dedicated Luxury View for Smart Linktree & Dynamic QR Hub (COMPLETED)
- [x] **TASK-901:** Decouple `SmartLinktreeVault` from the 8/4 column chat layout into a dedicated 12-column luxury view.
- [x] **TASK-902:** Add custom profile name (`customName`), subtitle, and avatar icon badge customization (`avatarIcon`) in `src/types/vault.ts` and `SmartLinktreeVault.tsx`.
- [x] **TASK-903:** Add expanded link categories (`media`, `crypto`) and custom badge tags (`tag`) to `EphemeralLink`.
- [x] **TASK-904:** Implement real QR customizer with 6 foreground colors, link protocol switcher (`#key=` vs `?key=`), and high-res PNG download.
- [x] **TASK-905:** Build interactive iPhone 16 Pro mockup with status bar, dynamic island, real-time click tracking, and live countdown timer.
- [x] **TASK-906:** Implement non-destructive slide-over live chat drawer for the Linktree Studio.

### Phase 10: Cloud Connectors & P2P WebRTC (PLANNED)
- [ ] **TASK-1001:** Implement automated Upstash Redis cluster failover for multi-instance deployments.
- [ ] **TASK-1002:** Implement AWS S3 / Cloudflare R2 pre-signed URL adapter with automated lifecycle policies (1-day auto-purge).
- [ ] **TASK-1003:** Implement WebRTC DataChannels P2P mesh for direct browser-to-browser encrypted transfers bypassing server memory entirely.
- [ ] **TASK-1004:** Add WebAuthn hardware security key (YubiKey / Passkey) pod protection option.

---

## 3. Verification & Test Matrix

| Test ID | Test Scenario | Expected Outcome | Status |
| :--- | :--- | :--- | :--- |
| **TEST-01** | Provision pod via `POST /api/pods` | Returns HTTP 200 with generated salt and metadata. Key is NOT present. | **PASSED** |
| **TEST-02** | Query pod state via `GET /api/pods/[id]` | Returns valid state with empty scratchpad and empty file array. | **PASSED** |
| **TEST-03** | Verify URL fragment isolation | Accessing `/pod/[id]#key=...` keeps key on client; network inspect reveals no key header or body. | **PASSED** |
| **TEST-04** | Cryptographic envelope packing roundtrip | Encrypting a test buffer and unpacking returns identical plaintext; SHA-256 matches. | **PASSED** |
| **TEST-05** | Active Janitor TTL Expiration | Pod with 10s test TTL is automatically wiped from memory by background sweeper. | **PASSED** |
| **TEST-06** | Manual "Purge Pod" Trigger | Invoking zeroize triggers 3D particle explosion, wipes memory, and closes SSE stream. | **PASSED** |
| **TEST-07** | Burn-on-Download File Shred | Downloading a file configured with `burnOnDownload: true` immediately evicts it from storage. | **PASSED** |
| **TEST-08** | WebGL 60fps Performance | 3D canvas maintains steady 60fps without dropped frames on 1080p/4K displays. | **PASSED** |
| **TEST-09** | Three.js Clock Deprecation Check | Browser console reports 0 warnings regarding `THREE.Clock`. | **PASSED** |
| **TEST-10** | Procedural Audio Synthesizer | Web Audio triggers synthetic clicks, pings, sirens, and white noise without external MP3 requests. | **PASSED** |
| **TEST-11** | Ephemeral Linktree & Smart QR Bundle Sync | Links added/removed sync across SSE; real-time click tracking increments dynamically; dynamic QR codes render cleanly. | **PASSED** |
| **TEST-12** | 1-Tap Social Sharing & Auto-Join Links | Query param auto-join URLs (`?key=...`) and hash URLs (`#key=...`) unlock rooms instantly; WhatsApp & Instagram share intents trigger with pre-filled invitations. | **PASSED** |
| **TEST-13** | Dedicated Studio View & Real QR Hub | Full-width 12-column layout isolates Linktree studio from chat; real QR generator produces customizable PNGs; custom profiles render in interactive iPhone mockup. | **PASSED** |
