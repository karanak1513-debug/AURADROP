# AURA DROP — Architectural Memory, ADRs & System Gotchas

**Document Version:** 2.0.0  
**Status:** Living Knowledge Repository  
**Owner:** Core Engineering & Architecture Team  

---

## 1. Architectural Decision Records (ADRs)

### ADR-001: URL Hash Fragment Isolation for Zero-Knowledge Keys
- **Context:** How to share a direct link to an encrypted room containing the decryption key without exposing the key to the server or intermediate proxy logs.
- **Decision:** Store the secret key strictly in the URL fragment (`#key=...`).
- **Rationale:** Under RFC 3986, user agents never send the `#` hash fragment in HTTP request headers. The server receives only `/pod/[id]`, leaving the key exclusively in client-side memory.
- **Consequences:** If a user bookmarks or copies the link, the key is preserved; however, if they strip the fragment, the room prompts for manual passphrase entry.

### ADR-002: Native W3C Web Crypto API vs. Third-Party Bundles
- **Context:** Choosing between external cryptographic libraries (e.g., `openpgp.js`, `crypto-js`, `node-forge`) versus browser-native APIs.
- **Decision:** Exclusively use `window.crypto.subtle` (Web Crypto API).
- **Rationale:**
  - Hardware-accelerated AES-NI instruction sets in modern CPUs/browsers.
  - Zero external supply-chain bundle risk (no npm dependencies for core encryption).
  - Guaranteed constant-time operations for AES-GCM and SHA-256 implemented in browser C++ engines.
- **Consequences:** Requires secure contexts (HTTPS or localhost).

### ADR-003: In-Memory Map Primary with Optional Upstash Redis
- **Context:** Designing ephemeral pod persistence that is both blindingly fast and deployable to serverless edge platforms.
- **Decision:** Implement primary storage as a volatile Node.js `Map<string, PodFullState>` with dual-write to Upstash Redis REST API when environment variables are supplied.
- **Rationale:**
  - Standard in-memory maps provide microsecond read/write operations with zero network latency.
  - Upstash Redis provides edge persistence across multi-region serverless instances with native `EXPIRE` TTL commands.
- **Consequences:** Single-instance dev environments run with zero configuration; production environments can scale horizontally by setting `UPSTASH_REDIS_REST_URL`.

### ADR-004: Three.js Refractive Glass Canvas with Mouse Parallax
- **Context:** The landing and workspace backdrops need to feel dynamic, premium, and alive without degrading UI legibility or GPU performance.
- **Decision:** Integrate a low-overhead WebGL canvas using Three.js and `@react-three/fiber` rendering 5 physical glass geometries with mouse parallax damping and a particle vaporization explosion system.
- **Rationale:**
  - Physical transmission and refraction embody the "zero-knowledge transparency" brand identity.
  - Particle vaporization provides a visceral, satisfying visual confirmation of data destruction.
- **Consequences:** Handled gracefully on low-end devices via low geometric polycounts and standard `requestAnimationFrame` loop throttling.

### ADR-005: "Aura Drop" Luxury Light Theme vs. Dark Cyberpunk
- **Context:** The initial prototype used dark green/red terminal aesthetics.
- **Decision:** Pivot completely to "Aura Drop"—an Apple-meets-Linear luminous light theme with alabaster `#F8FAFC`, pastel blue/lavender ambient radial glows, and high-translucency glassmorphism.
- **Rationale:**
  - Vastly superior legibility and modern elegance.
  - Differentiates the platform from clandestine hacker tools, positioning it as an executive-grade privacy suite.
- **Consequences:** Requires careful contrast management (`text-slate-900`, `text-slate-800` on glass surfaces).

### ADR-006: Web Audio Procedural Synthesis vs. Audio Asset Files
- **Context:** Tactile audio feedback (clicks, sirens, shredding noise) is critical for sensory confirmation of security operations.
- **Decision:** Synthesize all audio procedurally using native Web Audio API oscillators, biquad filters, and noise buffers in `src/lib/sound.ts`.
- **Rationale:**
  - Zero network latency (no downloading `.mp3` or `.wav` files).
  - Eliminates 404 audio asset errors and reduces build bundle size.
  - Instant mute toggle support.
- **Consequences:** Audio context must be resumed on first user gesture per browser autoplay policies.

### ADR-007: Ephemeral Linktree & Dynamic QR Code Engine
- **Context:** Users frequently need to bundle and distribute multiple external URLs (documents, repositories, design assets, communication channels) alongside uploaded files, accessible via dynamic, customizable QR codes.
- **Decision:** Build a self-destructing Linktree engine (`SmartLinktreeVault.tsx`) integrated directly into the workspace with live mobile phone preview, dynamic in-memory QR code generation, category tagging, color styling, and real-time click tracking synchronized across peers via SSE.
- **Rationale:**
  - Traditional Linktrees persist indefinitely on centralized servers with account tracking, ad pixels, and telemetry.
  - An ephemeral Linktree inherits the exact same zero-knowledge, self-destruct lifecycle (TTL countdown + panic kill switch zeroize) as all other pod artifacts.
  - Browser-native QR code rendering (`qrcode` library) produces instant downloadable PNGs with custom color palettes without external API requests.
- **Consequences:** All links and click counts cease to exist when the room timer expires or is manually wiped.

### ADR-008: 1-Tap Social Sharing & Seamless Auto-Join Links
- **Context:** Sharing rooms via mobile messaging applications (WhatsApp, Instagram, Telegram) often resulted in user friction when users had to manually copy, switch apps, paste room IDs, and enter passphrases. Additionally, social webviews occasionally mangle or drop URL `#` hash fragments in link cards.
- **Decision:** Implement a dual auto-join strategy:
  1. Primary zero-knowledge `#key=` hash links for standard browsing.
  2. Fallback `?key=` query parameter links for messaging platforms where `#` fragments are stripped by card scrapers.
  3. Client-side instant scrubbing (`window.history.replaceState`) on initial page load, which migrates query param keys into the client-side `#key=` hash and scrubs the query string from browser history, address bars, and referrer headers.
  4. 1-tap social intents (`whatsapp://send`, `t.me/share`, Instagram Story/DM clipboard formatting, and W3C Web Share API).
- **Rationale:** Minimizes user drop-off to zero taps while cryptographically protecting the secret passphrase from server logs and intermediate proxies.
- **Consequences:** Guests can enter active rooms seamlessly across any device or operating system with a single tap.

### ADR-009: Dedicated Luxury Studio View Architecture for Ephemeral Linktree & QR Hub
- **Context:** Previously, `SmartLinktreeVault` was confined inside an 8-column layout alongside a persistent 4-column live chat column. Because the Linktree interface itself is a dual-pane editor (management form + live mobile preview), nesting it inside 8 columns caused severe horizontal crowding and squeezed UI elements.
- **Decision:** Fully decouple workspace tab layouts:
  1. `Shared Files` tab: retains the 8-column vault + 4-column live chat side-by-side layout.
  2. `Smart QR & Linktree` tab: elevates into a dedicated, unconstrained 12-column luxury view with a 7/5 column internal split (spacious branding & link curation on left, dynamic QR customizer & interactive iPhone 16 Pro mockup on right).
  3. Non-destructive live chat: accessible within the studio view via an on-demand slide-over drawer triggered from the top action bar.
- **Rationale:** Delivers an uncompromised Apple/Linear-tier creative studio experience with abundant whitespace, large legible typography, custom vanity branding, and real dynamic QR code generation.
- **Consequences:** Provides ample screen real estate for deep link curation and custom avatars without losing quick access to peer chat.

---

## 2. Environment Quirks & Platform Gotchas

### 2.1 Windows Directory Name with Spaces & Caps (`MY OWN BACKEND`)
- **Symptom:** `npx create-next-app` failed because npm package naming rules forbid uppercase letters and spaces.
- **Resolution:** Scaffold Next.js in a temporary valid slug (`vault-zero-temp`) with `--skip-install`, move the files to the root, and configure `package.json` with a valid package name (`"name": "aura-drop"`).

### 2.2 Npm Scripts Restriction (`~/.npmrc` `EALLOWSCRIPTS`)
- **Symptom:** Running standard `npm install <package>` fails with `EALLOWSCRIPTS: script execution is disabled` because the global npmrc restricts scripts to `["esbuild"]`.
- **Resolution:** Always append `--ignore-scripts` when installing new packages in this workspace:
  ```bash
  npm install <pkg> --ignore-scripts
  ```

### 2.3 Windows Playwright Driver 404 CDN Issue
- **Symptom:** Invoking `browser_subagent` fails immediately on Windows because Playwright's Azure CDN returns HTTP 404 when downloading `playwright-1.57.0-win32_x64.zip`.
- **Resolution:** Do not attempt automated browser subagents in this environment. Validate web endpoints using `Invoke-WebRequest` or Node.js fetch commands.

### 2.4 Three.js `THREE.Clock` Deprecation in v0.170+
- **Symptom:** Browser console warning: `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.`
- **Resolution:** In `src/components/canvas/AuraCanvas.tsx`, use `performance.now()` directly for frame delta calculations:
  ```typescript
  const startTime = performance.now();
  const elapsed = (performance.now() - startTime) * 0.001;
  ```

### 2.5 Windows PowerShell JSON Escaping in CLI Testing
- **Symptom:** Running `curl.exe` with escaped quotes (`\"`) in PowerShell results in `SyntaxError: Expected property name or '}' in JSON`.
- **Resolution:** Execute API tests using Node.js one-liners (`node -e "fetch(...)"`) which handle string serialization cleanly across all platforms.

---

## 3. Key File Index & Module Map

| File Path | Primary Responsibilities |
| :--- | :--- |
| [`src/types/vault.ts`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/types/vault.ts) | Domain interfaces: `PodConfig`, `PodMetadata`, `ScratchpadData`, `VaultFileMetadata`, `AuditEvent`, `Peer`. |
| [`src/lib/crypto.ts`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/lib/crypto.ts) | PBKDF2 key derivation, AES-256-GCM AEAD encryption/decryption, binary envelope packing (`CD01`), and `wipeMemory()`. |
| [`src/lib/storage.ts`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/lib/storage.ts) | In-memory store, 10-second background janitor sweeper, DoD zero-fill simulation, and SSE pub/sub event bus. |
| [`src/lib/sound.ts`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/lib/sound.ts) | Web Audio procedural oscillator synthesizers for clicks, pings, sirens, and white noise vaporization bursts. |
| [`src/components/canvas/AuraCanvas.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/canvas/AuraCanvas.tsx) | Three.js WebGL canvas rendering 5 physical refractive glass shapes, mouse parallax damping, and particle explosion. |
| [`src/components/landing/LandingHub.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/landing/LandingHub.tsx) | Ephemeral pod provisioning hub with NATO codename generator, segmented TTL selector, and OPSEC toggles. |
| [`src/components/layout/Navbar.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/layout/Navbar.tsx) | Floating pill navigation bar with edge latency indicator, audio toggle, and quick purge button. |
| [`src/components/workspace/WorkspaceHUD.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/WorkspaceHUD.tsx) | Dynamic SVG circular countdown timer, active peer rings, mobile QR sync modal, and zeroize trigger modal. |
| [`src/components/workspace/Scratchpad.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/Scratchpad.tsx) | Luminous collaborative scratchpad with line numbers, floating formatting bar, and markdown export FAB. |
| [`src/components/workspace/DeadDropVault.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/DeadDropVault.tsx) | "The Ingestion Vault" with tactile dragzone, SHA-256 fingerprint pills, and instant single-click file vaporization. |
| [`src/components/workspace/SmartLinktreeVault.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/SmartLinktreeVault.tsx) | Self-destructing ephemeral Linktree & dynamic QR generator studio with live mobile mockup and real-time click tracking. |
| [`src/components/workspace/SocialShareModal.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/SocialShareModal.tsx) | 1-Tap social sharing suite (WhatsApp, Instagram, Telegram, Web Share API) with dynamic auto-join URLs and QR PNG export. |
| [`src/components/workspace/TacticalSignalStream.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/TacticalSignalStream.tsx) | Ephemeral transient peer chat (memory-only) and live security audit event trail. |
| [`src/components/workspace/ZeroizeOverlay.tsx`](file:///c:/Users/karan/OneDrive/Desktop/MY%20OWN%20BACKEND/src/components/workspace/ZeroizeOverlay.tsx) | Full-screen decontamination sequence with 5-stage memory wipe audit and sound burst. |
