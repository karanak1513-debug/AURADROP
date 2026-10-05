'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface AuraCanvasProps {
  isVaporizing?: boolean;
}

export function AuraCanvas({ isVaporizing = false }: AuraCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isVaporizingRef = useRef(isVaporizing);

  useEffect(() => {
    isVaporizingRef.current = isVaporizing;
  }, [isVaporizing]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let animId: number;
    let renderer: THREE.WebGLRenderer | null = null;
    let isMounted = true;
    let isTabVisible = true;

    // Defer initialization to avoid blocking main thread UI rendering
    const initTimer = setTimeout(() => {
      if (!isMounted || !container) return;

      const isMobile = typeof window !== 'undefined' && window.innerWidth < 768;

      // 1. Scene, Camera, Renderer
      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(
        45,
        window.innerWidth / window.innerHeight,
        0.1,
        100
      );
      camera.position.z = 12;

      renderer = new THREE.WebGLRenderer({
        alpha: true,
        antialias: !isMobile,
        powerPreference: 'high-performance',
      });
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.setPixelRatio(isMobile ? 1.0 : Math.min(window.devicePixelRatio || 1, 1.5));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.1;
      container.appendChild(renderer.domElement);

      // 2. Lighting (Curated Studio Lighting)
      const ambientLight = new THREE.AmbientLight(0xffffff, 1.4);
      scene.add(ambientLight);

      const keyLight = new THREE.DirectionalLight(0xe0f2fe, 2.5);
      keyLight.position.set(6, 8, 8);
      scene.add(keyLight);

      const fillLight = new THREE.DirectionalLight(0xede9fe, 2.0);
      fillLight.position.set(-8, -4, 6);
      scene.add(fillLight);

      const rimLight = new THREE.PointLight(0x6366f1, 3.0, 20);
      rimLight.position.set(0, 4, 3);
      scene.add(rimLight);

      // 3. Floating Refractive Glass Geometries (High Performance Clearcoat)
      const glassGroup = new THREE.Group();
      scene.add(glassGroup);

      const createGlassMat = (color: number, roughness = 0.08) => {
        return new THREE.MeshPhysicalMaterial({
          color,
          roughness,
          metalness: 0.12,
          clearcoat: 1.0,
          clearcoatRoughness: 0.08,
          reflectivity: 0.85,
          transparent: true,
          opacity: 0.8,
        });
      };

      // Shape 1: Central Torus
      const mat1 = createGlassMat(0x6366f1);
      const torus = new THREE.Mesh(
        new THREE.TorusGeometry(1.6, 0.45, isMobile ? 12 : 24, isMobile ? 24 : 48),
        mat1
      );
      torus.position.set(-3.2, 1.2, 0);
      glassGroup.add(torus);

      // Shape 2: Refractive Icosahedron Gem
      const mat2 = createGlassMat(0x06b6d4, 0.05);
      const ico = new THREE.Mesh(new THREE.IcosahedronGeometry(1.2, 0), mat2);
      ico.position.set(3.8, 1.8, -1);
      glassGroup.add(ico);

      // Shape 3: Refractive Smooth Sphere
      const mat3 = createGlassMat(0xa855f7, 0.1);
      const sphere = new THREE.Mesh(
        new THREE.SphereGeometry(1.1, isMobile ? 12 : 24, isMobile ? 12 : 24),
        mat3
      );
      sphere.position.set(2.4, -2.2, 0.5);
      glassGroup.add(sphere);

      // Shape 4: Floating Octahedron
      const mat4 = createGlassMat(0x38bdf8, 0.08);
      const octa = new THREE.Mesh(new THREE.OctahedronGeometry(1.3, 0), mat4);
      octa.position.set(-2.8, -2.4, -0.5);
      glassGroup.add(octa);

      // Shape 5: Translucent Ring
      const mat5 = createGlassMat(0xf43f5e, 0.12);
      const ring = new THREE.Mesh(
        new THREE.TorusGeometry(0.8, 0.25, isMobile ? 12 : 20, isMobile ? 20 : 36),
        mat5
      );
      ring.position.set(0.2, 3.2, -2);
      glassGroup.add(ring);

      // 4. Ambient Floating Light Specks
      const particleCount = isMobile ? 40 : 100;
      const particleGeo = new THREE.BufferGeometry();
      const particlePositions = new Float32Array(particleCount * 3);
      for (let i = 0; i < particleCount * 3; i += 3) {
        particlePositions[i] = (Math.random() - 0.5) * 20;
        particlePositions[i + 1] = (Math.random() - 0.5) * 16;
        particlePositions[i + 2] = (Math.random() - 0.5) * 10;
      }
      particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
      const particleMat = new THREE.PointsMaterial({
        color: 0x818cf8,
        size: 0.06,
        transparent: true,
        opacity: 0.6,
        blending: THREE.AdditiveBlending,
      });
      const particles = new THREE.Points(particleGeo, particleMat);
      scene.add(particles);

      // 5. Parallax Handler
      let mouseX = 0;
      let mouseY = 0;
      let targetX = 0;
      let targetY = 0;

      const handleMouseMove = (e: MouseEvent) => {
        const halfW = window.innerWidth / 2;
        const halfH = window.innerHeight / 2;
        mouseX = (e.clientX - halfW) / halfW;
        mouseY = (e.clientY - halfH) / halfH;
      };
      if (!isMobile) {
        window.addEventListener('mousemove', handleMouseMove, { passive: true });
      }

      // 6. Resize Handler
      const handleResize = () => {
        if (!renderer) return;
        camera.aspect = window.innerWidth / window.innerHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(window.innerWidth, window.innerHeight);
      };
      window.addEventListener('resize', handleResize, { passive: true });

      // 7. Visibility Change: Pause animation loop when tab is backgrounded
      const handleVisibilityChange = () => {
        isTabVisible = !document.hidden;
        if (isTabVisible && isMounted) {
          animId = requestAnimationFrame(animate);
        }
      };
      document.addEventListener('visibilitychange', handleVisibilityChange);

      // 8. Optimized Animation Loop
      const startTime = performance.now();

      const animate = () => {
        if (!isMounted || !isTabVisible || !renderer) return;

        animId = requestAnimationFrame(animate);
        const elapsed = (performance.now() - startTime) * 0.001;

        if (!isMobile) {
          targetX += (mouseX * 0.8 - targetX) * 0.04;
          targetY += (-mouseY * 0.8 - targetY) * 0.04;
          glassGroup.position.x = targetX;
          glassGroup.position.y = targetY;
        }

        torus.rotation.x = elapsed * 0.2;
        torus.rotation.y = elapsed * 0.28;
        torus.position.y = 1.2 + Math.sin(elapsed * 1.1) * 0.12;

        ico.rotation.x = elapsed * 0.25;
        ico.rotation.z = elapsed * 0.18;
        ico.position.y = 1.8 + Math.cos(elapsed * 1.3) * 0.15;

        sphere.position.y = -2.2 + Math.sin(elapsed * 0.9) * 0.1;

        octa.rotation.y = elapsed * 0.3;
        octa.position.y = -2.4 + Math.cos(elapsed * 1.2) * 0.12;

        ring.rotation.z = elapsed * 0.18;
        ring.position.y = 3.2 + Math.sin(elapsed * 0.8) * 0.15;

        particles.rotation.y = elapsed * 0.015;

        renderer.render(scene, camera);
      };

      animate();
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(initTimer);
      cancelAnimationFrame(animId);
      if (renderer?.domElement?.parentElement) {
        renderer.domElement.parentElement.removeChild(renderer.domElement);
      }
      renderer?.dispose();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 pointer-events-none z-0 overflow-hidden"
      style={{ opacity: 0.85 }}
    />
  );
}
