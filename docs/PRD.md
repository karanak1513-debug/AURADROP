# AURA DROP — Product Requirements Document (PRD)

**Document Version:** 2.0.0  
**Status:** Approved / Active Architecture  
**Theme:** "Aura Drop" — Luminous Luxury Light Theme (Apple-meets-Linear)  
**Classification:** Zero-Knowledge Ephemeral Collaboration Platform  

---

## 1. Executive Summary & Product Vision

**AURA DROP** is a high-aesthetic, ultra-secure, ephemeral dead-drop and collaborative workspace platform designed for temporary, high-stakes data exchange. Moving deliberately away from dystopian dark cyberpunk tropes, AURA DROP introduces an **Apple-meets-Linear** luminous aesthetic—an immaculate blend of alabaster surfaces, ambient pastel blue/lavender atmospheric glows, high-translucency glassmorphism, and an interactive WebGL 3D refractive glass canvas.

### The Core Philosophy: "Zero Trace, Zero Knowledge"
1. **Zero Accounts:** No email, no phone, no OAuth, no user tracking, no session cookies.
2. **Zero Knowledge:** All cryptographic operations (PBKDF2 100,000 rounds, AES-256-GCM authenticated cipher, SHA-256 integrity verification) occur strictly client-side in the browser via the W3C Web Crypto API. The server never receives, stores, or processes decryption keys or plaintext data.
3. **URL Fragment Key Isolation:** The 256-bit decryption key resides solely in the URL hash fragment (`https://auradrop.io/pod/CYPHER-749-ALPHA#key=...`). Under RFC 3986, URL fragments are never transmitted over the wire or logged in server access logs.
4. **Absolute Ephemeral Lifecycle:** Every Pod has a mandatory Time-To-Live (TTL: 15 minutes, 1 hour, 6 hours, or 24 hours). An automated background sweeper and immediate panic trigger execute DoD 5220.22-M zero-fill memory overwrites (`Buffer.fill(0)`), ensuring irreversible data obliteration.

---

## 2. Target Personas & Use Cases

### 2.1 Target Personas
- **The Security Researcher / Whistleblower:** Requires an un-cachable, untraceable conduit to share sensitive disclosures, logs, or evidence without leaving browser or server breadcrumbs.
- **The Infrastructure Engineer / DevSecOps:** Needs to pass production database secrets, API keys, or `.env` files to a colleague without polluting Slack, Teams, or ticketing systems.
- **The Executive & Legal Counsel:** Needs a secure, self-destructing review room to inspect confidential M&A documents, financial models, or contracts with zero residual footprint.
- **The Tactical Pair Programmers:** Need a transient, real-time shared scratchpad with live code formatting, line numbers, and instant file shredding.

### 2.2 Primary Use Cases
1. **Transient Credential Drop:** One peer creates a 15-minute pod, drops high-entropy credentials, sends the link with `#key=...`, the second peer reads the credentials, and triggers "Purge Pod" to vaporize the workspace immediately.
2. **Burn-on-Download File Exchange:** An encrypted binary envelope is uploaded. Once downloaded by the intended recipient, the file is automatically shredded from storage.
3. **Collaborative Ephemeral War-Room:** A distributed team collaborates on an incident response note with real-time encrypted scratchpad synchronization, file inspection, and transient peer chat.

---

## 3. Core Functional Requirements

### 3.1 Ephemeral Pod Provisioning
- **NATO Room Identifier:** Automated generator producing memorable military/aviation alphanumeric codenames (e.g., `TITAN-831-ECHO`, `VALKYRIE-409-GHOST`).
- **Cryptographic Salt Generation:** Client-side generation of cryptographically secure 128-bit random salt (`crypto.getRandomValues`) encoded as Base64.
- **Configurable Lifecycles (TTL):**
  - `15m` (Flash Exchange)
  - `1h` (Standard Operation - Default)
  - `6h` (Deep Session)
  - `24h` (Maximum Ephemeral Window)
- **Operational Security (OPSEC) Toggles:**
  - **Burn-on-Download:** Uploaded files self-destruct immediately after first successful download.
  - **Burn-on-Disconnect:** Pod initiates complete wipe sequence when the peer count drops to zero.
  - **Guest Read-Only:** Only the pod creator can modify the scratchpad and upload files; joining peers have decrypt-only privileges.
- **256-bit Key Generator:** One-click generation of military-grade, high-entropy passphrases or hex keys, automatically appended to `#key=...`.

### 3.2 Client-Side Cryptography Pipeline
- **Key Derivation Function (KDF):** PBKDF2 using SHA-256 with 100,000 iterations to protect against GPU brute-force attacks.
- **Symmetric Cipher:** AES-256-GCM (Galois/Counter Mode) providing authenticated encryption with associated data (AEAD).
- **Nonce/IV Management:** Fresh cryptographically secure 12-byte (96-bit) Initialization Vector generated per encryption operation.
- **Binary Envelope Packing (`CD01` Format):**
  - Bytes 0-3: Magic Header `CD01` (Cyphredrop / Aura Drop v1)
  - Bytes 4-15: 12-byte AES-GCM IV
  - Bytes 16+: AES-256-GCM Ciphertext + 16-byte Authentication Tag
- **Integrity Verification:** SHA-256 digest computed before encryption and verified post-decryption.
- **Memory Sanitation:** Immediate zeroing (`Uint8Array.fill(0)`) of sensitive key material and plaintext buffers upon component unmount or purge.

### 3.3 Workspace User Experience & Layout
- **Interactive Glass Header & HUD:**
  - Floating pill-shaped navigation container with 3D glass refraction.
  - Dynamic SVG circular countdown timer with color states:
    - Opal Cyan (`#06B6D4`): Normal state ($>50\%$ TTL remaining).
    - Liquid Amber (`#F59E0B`): Warning state ($10\% - 50\%$ TTL remaining).
    - Pulsing Coral (`#F43F5E`): Critical state ($<5\text{m}$ TTL remaining).
  - Active peer indicator showing avatar silhouettes with glowing emerald activity rings.
  - Quick-action "Purge Pod" button styled in frosted glass with red hover radiance.
  - Mobile QR Handshake modal generating instant encrypted transfer codes.
- **Dual-Pane Luminous Workspace:**
  - **Left Pane: Luminous Scratchpad:**
    - Precision line numbers with smooth scrolling.
    - Floating frosted formatting toolbar (`Bold`, `Code`, `Cleanse`).
    - Multi-mode switcher (`MARKDOWN`, `CODE`, `KEY`).
    - Real-time client-side encryption indicator (`AES-256-GCM Active`).
    - Floating Action Button (FAB) for clean plaintext or decrypted markdown export.
  - **Right Pane: The Ingestion Vault:**
    - Drag-and-drop ingestion zone with animated dashed borders shifting color on hover.
    - Tactile grab feedback (`scale: 1.02`).
    - Encrypted file cards with file-type icons, size badges, SHA-256 fingerprint pills, and preview modal.
    - Single-click **"Vaporize"** button to execute instant DoD zero-fill deletion.
- **Transient Tactical Signal Stream:**
  - Zero-knowledge peer broadcast chat living solely in volatile browser memory.
  - Iridescent gradient speech bubbles with peer codenames and timestamps.
  - Real-time security audit log tracking peer joins, updates, uploads, and purges.

### 3.4 3D Visual Atmosphere & Particle Vaporization
- **Three.js / WebGL Canvas (`AuraCanvas.tsx`):**
  - Renders 5 floating, slowly tumbling physical glass geometries: Central Torus, Faceted Icosahedron Gem, Translucent Opal Sphere, Octahedron, and Gyro Ring.
  - Physical glass transmission ($0.95$), index of refraction ($\text{IOR } 1.52$), and chromatic dispersion.
  - Smooth mouse-parallax dampening reacting to cursor velocity.
- **Particle Vaporization Explosion:**
  - Upon pod purge or TTL zero, triggers a WebGL particle explosion dissolving the 3D geometry into 1,200 iridescent light specks.
  - Synchronized with full-screen `ZeroizeOverlay` and Web Audio white-noise vaporization burst.

---

## 4. Non-Functional Requirements (NFRs)

| Category | Requirement Specification |
| :--- | :--- |
| **Security & Privacy** | Zero telemetry, zero third-party scripts, zero cookies. Zero plaintext persistence on server or disk. |
| **Performance** | Initial Page Load $< 800\text{ms}$. WebGL 3D Canvas running at sustained $60\text{ fps}$. Client-side AES encryption/decryption $< 30\text{ms}$ for payloads up to 10MB. |
| **Reliability** | Active background janitor running every 10 seconds to ensure expired pods are shredded even if no clients are connected. |
| **Responsiveness** | Fluid adaptive layout supporting desktop (1920x1080, 1440x900), tablet (768x1024), and mobile (375x812) viewports. |
| **Accessibility** | High-contrast text compliance against glass backgrounds (`text-slate-900`, `text-slate-800`), keyboard navigation, and ARIA roles for modals and inputs. |

---

## 5. Acceptance Criteria

1. **Client Isolation:** Visiting `/pod/[id]` without a `#key=...` fragment prompts the user for a manual passphrase or stops unauthorized decryption gracefully.
2. **Server Zero-Knowledge:** Inspecting network traffic confirms that no plaintext scratchpad content or unencrypted files are ever sent over HTTP.
3. **Purge Verification:** Triggering "Purge Pod" wipes client memory, sends the zeroize command to `/api/pods/[id]`, triggers the 3D particle explosion, and redirects to the landing page with zero residual state.
4. **Automated Janitor:** Pods exceeding their TTL are automatically wiped from server memory without requiring external cron jobs or user intervention.
