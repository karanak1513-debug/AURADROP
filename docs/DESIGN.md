# AURA DROP — Design System, 3D WebGL & Aesthetics Specification

**Document Version:** 2.0.0  
**Design Director:** Principal 3D Creative Technologist & Elite UI/UX Architect  
**Design Aesthetic:** "Aura Drop" — Apple-meets-Linear Luminous Luxury Light Theme  

---

## 1. Design Philosophy & Creative Vision

"AURA DROP" represents a radical departure from conventional cybersecurity aesthetics. Traditional security software relies on dark, terminal-green or red cyberpunk tropes that evoke paranoia, criminality, and espionage.

In contrast, **AURA DROP** elevates data protection into an experience of **purity, precision, and architectural serenity**:
- **Luminosity over Darkness:** Alabaster surfaces infused with soft ambient lavender and cyan light gradients.
- **Glassmorphism as Metaphor:** Translucent physical glass cards signify transparency and clarity, while high refraction emphasizes structural integrity.
- **Micro-Detailing (Linear-Grade):** Razor-thin borders (`1px border-white/90`), subtle atmospheric drop shadows (`0 20px 40px -15px rgba(0,0,0,0.05)`), and crisp monospace metrics.
- **Tactile Materiality:** Elements respond to user input with physics-based springs and micro-scale elevations.

---

## 2. Color System & Design Tokens

### 2.1 Color Palette Specifications

```css
:root {
  /* Ambient Foundations */
  --aura-base: #F8FAFC;          /* Alabaster / Milk White */
  --aura-surface: rgba(255, 255, 255, 0.70);
  --aura-surface-elevated: rgba(255, 255, 255, 0.85);
  --aura-border: rgba(255, 255, 255, 0.90);

  /* Ambient Atmospheric Backdrops */
  --aura-glow-cyan: #E0F2FE;      /* Soft Pastel Cyan */
  --aura-glow-lavender: #EDE9FE;  /* Ethereal Soft Lavender */
  --aura-glow-rose: #FFE4E6;      /* Ambient Soft Rose */

  /* High-Contrast Accents */
  --aura-indigo: #6366F1;         /* Electric Indigo */
  --aura-cyan: #06B6D4;           /* Opal Cyan */
  --aura-emerald: #10B981;        /* Operational / Online Peer Emerald */

  /* State Alerts & Vaporization */
  --aura-amber: #F59E0B;          /* Warning TTL (< 50%) */
  --aura-coral: #F43F5E;          /* Critical Countdown / Panic Kill (< 5m) */

  /* Text & Metrics */
  --aura-text-primary: #0F172A;   /* Slate 900 */
  --aura-text-secondary: #475569; /* Slate 600 */
  --aura-text-muted: #94A3B8;     /* Slate 400 */
}
```

### 2.2 Glassmorphism Token Matrix

| Component Level | Tailwind Classes | Visual Target |
| :--- | :--- | :--- |
| **Level 0 (Base Canvas)** | `bg-[#F8FAFC]` with SVG ambient radial overlays | Ethereal floating depth |
| **Level 1 (Workspace Cards)** | `bg-white/70 backdrop-blur-3xl border border-white/90 shadow-[0_20px_40px_-15px_rgba(0,0,0,0.05)]` | High-translucency frosted glass |
| **Level 2 (Floating Toolbar)** | `bg-white/85 backdrop-blur-2xl border border-white/95 shadow-lg shadow-indigo-500/5` | Floating precision control |
| **Level 3 (Modal / Overlays)** | `bg-white/90 backdrop-blur-3xl border border-white shadow-2xl shadow-slate-900/10` | Elevated focus modal |
| **Level 4 (Pill Badges)** | `bg-white/60 backdrop-blur-md border border-white/80 px-2.5 py-1 rounded-full` | Precision technical chip |

---

## 3. Interactive 3D WebGL Canvas (`AuraCanvas.tsx`)

### 3.1 Scene Composition & Geometries
The background canvas executes an interactive Three.js scene featuring 5 refractive geometric meshes:

1. **Central Refractive Torus:**
   - Geometry: `THREE.TorusGeometry(2.4, 0.65, 32, 100)`
   - Position: `(0, 0, -1)`
   - Movement: Dual-axis slow rotation (`x += 0.003, y += 0.005`)
2. **Faceted Icosahedron Gem:**
   - Geometry: `THREE.IcosahedronGeometry(1.6, 0)`
   - Position: `(-4.5, 2.2, -2)`
   - Movement: Multi-axis tumble (`x += 0.004, z += 0.003`)
3. **Translucent Opal Sphere:**
   - Geometry: `THREE.SphereGeometry(1.5, 64, 64)`
   - Position: `(4.8, -1.8, -2)`
   - Movement: Floating orbital motion
4. **Dual-Pyramid Octahedron:**
   - Geometry: `THREE.OctahedronGeometry(1.4, 0)`
   - Position: `(-3.8, -2.5, -1.5)`
   - Movement: Slow reverse axial spin
5. **Floating Outer Gyro Ring:**
   - Geometry: `THREE.TorusGeometry(3.6, 0.15, 16, 100)`
   - Position: `(0, 0, -2.5)`
   - Movement: Precession counter-rotation

### 3.2 Physical Glass Shading (`MeshPhysicalMaterial`)
```typescript
const glassMaterial = new THREE.MeshPhysicalMaterial({
  color: 0xffffff,
  roughness: 0.05,
  metalness: 0.08,
  transmission: 0.94,       // Deep light pass-through
  ior: 1.52,                // Crown glass index of refraction
  reflectivity: 0.5,
  thickness: 2.2,
  specularIntensity: 1.0,
  specularColor: 0x818cf8,  // Soft Indigo chromatic highlight
  transparent: true,
  opacity: 0.85,
});
```

### 3.3 Mouse-Parallax Dampening Math
Cursor coordinates are normalized from screen space to the range $[-1, 1]$:
```typescript
mouseX = (clientX - windowWidth / 2) / (windowWidth / 2);
mouseY = (clientY - windowHeight / 2) / (windowHeight / 2);
```
During the render loop, the camera smoothly interpolates toward the target position:
```typescript
const targetX = mouseX * 0.75;
const targetY = -mouseY * 0.5;
camera.position.x += (targetX - camera.position.x) * 0.04;
camera.position.y += (targetY - camera.position.y) * 0.04;
camera.lookAt(0, 0, 0);
```

### 3.4 3D Particle Vaporization Explosion
When `isVaporizing` triggers:
1. All geometric meshes are instantly hidden (`mesh.visible = false`).
2. A particle system consisting of **1,200 points** is spawned at the scene center.
3. Each particle is initialized with a randomized spherical velocity vector:
```typescript
velocities[i]     = (Math.random() - 0.5) * 0.22;
velocities[i + 1] = (Math.random() - 0.5) * 0.22;
velocities[i + 2] = (Math.random() - 0.5) * 0.22;
```
4. On each frame, positions are updated by adding velocity vectors, and material opacity decays at `-0.008` per frame until full scene annihilation.

---

## 4. UI Layout & Micro-Animations

### 4.1 Fluid Circular Countdown Timer
Rendered via dynamic SVG path calculation in `WorkspaceHUD.tsx`:
```typescript
const radius = 22;
const circumference = 2 * Math.PI * radius; // ~138.23
const strokeDashoffset = circumference - (fractionRemaining * circumference);
```
- **Stroke Colors:**
  - $>50\%$: `#06B6D4` (Opal Cyan)
  - $10\% - 50\%$: `#F59E0B` (Liquid Amber)
  - $<10\%$ or $<5\text{m}$: `#F43F5E` (Pulsing Coral Red)

### 4.2 Luminous Scratchpad Formatting Toolbar
- **Floating Pill Container:** Hovering above the active textarea with spring emergence.
- **Action Buttons:**
  - `Bold` (`**text**` wrapper)
  - `Code` (` ```code``` ` block wrapper)
  - `Cleanse` (Immediate local memory overwrite and text clear)
- **Status Indicator:** Glowing cyan badge: `AES-256-GCM Active`.

### 4.3 Tactile Ingestion Vault Dragzone
- **Dashed Border Animation:** Animated gradient borders pulse softly.
- **Hover / Drag Over:** Zone scales up to `1.02` with border shifting to vibrant `#6366F1`.
- **Card Micro-Interactions:**
  - Hovering a card reveals the SHA-256 fingerprint pill.
  - Hovering the "Vaporize" icon triggers a red radial glow and tooltip: *"Permanent Zero-Fill"*.

---

## 5. Procedural Audio Feedback (`sound.ts`)

Synthesized dynamically via the Web Audio API without external audio asset downloads:

| Sound Event | Oscillator / Filter Type | Frequency Range | Duration | Aesthetic Purpose |
| :--- | :--- | :--- | :--- | :--- |
| **Subtle Click** | Sine wave with exponential decay | $800\text{Hz} \rightarrow 300\text{Hz}$ | $35\text{ms}$ | Tactile button press |
| **Keypress** | Bandpass filtered noise burst | Center $1200\text{Hz}$ | $20\text{ms}$ | Physical keyboard feel |
| **File Ingest Ping** | Dual sine harmonic chime | $520\text{Hz} + 780\text{Hz}$ | $180\text{ms}$ | Successful encryption & upload |
| **Warning Siren** | Triangle frequency sweep | $440\text{Hz} \rightarrow 880\text{Hz}$ | $300\text{ms}$ | Countdown $<5\text{m}$ warning |
| **Vaporization Burst** | High-pass filtered white noise | Decaying gain curve | $850\text{ms}$ | DoD shred & particle explosion |
