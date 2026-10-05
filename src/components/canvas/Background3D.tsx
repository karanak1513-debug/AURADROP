'use client';

import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

interface Background3DProps {
  isVaporizing?: boolean;
  timeRemainingRatio?: number; // 0 to 1
  className?: string;
}

export function Background3D({
  isVaporizing = false,
  timeRemainingRatio = 1,
  className = '',
}: Background3DProps) {
  const mountRef = useRef<HTMLDivElement>(null);
  const isVaporizingRef = useRef(isVaporizing);

  useEffect(() => {
    isVaporizingRef.current = isVaporizing;
  }, [isVaporizing]);

  useEffect(() => {
    const container = mountRef.current;
    if (!container) return;

    // 1. Scene setup
    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0xf8fafc, 0.04);

    // 2. Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 9);

    // 3. Renderer with high DPR
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.35;
    container.appendChild(renderer.domElement);

    // 4. Lighting - Soft Ambient + Dual Luxury Opal/Indigo Spotlights
    const ambientLight = new THREE.AmbientLight(0xffffff, 1.8);
    scene.add(ambientLight);

    const lightCyan = new THREE.DirectionalLight(0x06b6d4, 2.5);
    lightCyan.position.set(-6, 7, 5);
    scene.add(lightCyan);

    const lightIndigo = new THREE.DirectionalLight(0x6366f1, 2.8);
    lightIndigo.position.set(6, -5, 6);
    scene.add(lightIndigo);

    const lightCoral = new THREE.PointLight(0xf43f5e, 0.8, 15);
    lightCoral.position.set(0, 4, 3);
    scene.add(lightCoral);

    // 5. Refractive Glass Materials
    const glassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      metalness: 0.05,
      roughness: 0.08,
      transmission: 0.94,
      ior: 1.52,
      thickness: 1.6,
      specularIntensity: 1.2,
      specularColor: new THREE.Color(0xe0f2fe),
      transparent: true,
      opacity: 0.9,
    });

    const gemMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xecfeff,
      metalness: 0.08,
      roughness: 0.05,
      transmission: 0.96,
      ior: 1.65,
      thickness: 2.0,
      specularIntensity: 1.4,
      specularColor: new THREE.Color(0xa5f3fc),
      transparent: true,
      opacity: 0.92,
    });

    const violetGlassMaterial = new THREE.MeshPhysicalMaterial({
      color: 0xf5f3ff,
      metalness: 0.05,
      roughness: 0.07,
      transmission: 0.93,
      ior: 1.54,
      thickness: 1.8,
      specularIntensity: 1.3,
      specularColor: new THREE.Color(0xc7d2fe),
      transparent: true,
      opacity: 0.88,
    });

    // 6. Geometric Polyhedrons
    const geometriesGroup = new THREE.Group();
    scene.add(geometriesGroup);

    // Center Gem (Icosahedron)
    const gemGeo = new THREE.IcosahedronGeometry(1.2, 0);
    const gemMesh = new THREE.Mesh(gemGeo, gemMaterial);
    gemMesh.position.set(0, 0.2, 0);
    geometriesGroup.add(gemMesh);

    // Floating Torus Knot
    const torusGeo = new THREE.TorusKnotGeometry(0.85, 0.24, 128, 32);
    const torusMesh = new THREE.Mesh(torusGeo, glassMaterial);
    torusMesh.position.set(-3.2, 1.4, -1.5);
    geometriesGroup.add(torusMesh);

    // Octahedron Prism
    const octaGeo = new THREE.OctahedronGeometry(1.1, 0);
    const octaMesh = new THREE.Mesh(octaGeo, violetGlassMaterial);
    octaMesh.position.set(3.4, -1.2, -1.0);
    geometriesGroup.add(octaMesh);

    // Translucent Sphere
    const sphereGeo = new THREE.SphereGeometry(0.85, 48, 48);
    const sphereMesh = new THREE.Mesh(sphereGeo, glassMaterial);
    sphereMesh.position.set(2.6, 2.0, -2.0);
    geometriesGroup.add(sphereMesh);

    // Dodecahedron Anchor
    const dodecaGeo = new THREE.DodecahedronGeometry(0.9, 0);
    const dodecaMesh = new THREE.Mesh(dodecaGeo, violetGlassMaterial);
    dodecaMesh.position.set(-2.8, -2.1, -1.2);
    geometriesGroup.add(dodecaMesh);

    // Ambient floating dust particles
    const particleCount = 200;
    const particleGeo = new THREE.BufferGeometry();
    const particlePos = new Float32Array(particleCount * 3);
    for (let i = 0; i < particleCount * 3; i += 3) {
      particlePos[i] = (Math.random() - 0.5) * 18;
      particlePos[i + 1] = (Math.random() - 0.5) * 14;
      particlePos[i + 2] = (Math.random() - 0.5) * 10;
    }
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePos, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x818cf8,
      size: 0.05,
      transparent: true,
      opacity: 0.45,
    });
    const dustParticles = new THREE.Points(particleGeo, particleMat);
    scene.add(dustParticles);

    // 7. Vaporization Particle Cloud (Triggered upon Nuke / Expiration)
    let explosionSystem: THREE.Points | null = null;
    let explosionVelocities: Float32Array | null = null;
    let isExploding = false;

    const triggerVaporization = () => {
      if (isExploding) return;
      isExploding = true;

      // Hide geometries
      geometriesGroup.visible = false;
      dustParticles.visible = false;

      const vaporCount = 1400;
      const positions = new Float32Array(vaporCount * 3);
      explosionVelocities = new Float32Array(vaporCount * 3);

      for (let i = 0; i < vaporCount * 3; i += 3) {
        // Random spherical dispersion
        const theta = Math.random() * Math.PI * 2;
        const phi = Math.acos(Math.random() * 2 - 1);
        const speed = 0.04 + Math.random() * 0.12;

        positions[i] = (Math.random() - 0.5) * 3;
        positions[i + 1] = (Math.random() - 0.5) * 3;
        positions[i + 2] = (Math.random() - 0.5) * 3;

        explosionVelocities[i] = Math.sin(phi) * Math.cos(theta) * speed;
        explosionVelocities[i + 1] = Math.sin(phi) * Math.sin(theta) * speed;
        explosionVelocities[i + 2] = Math.cos(phi) * speed;
      }

      const vaporGeo = new THREE.BufferGeometry();
      vaporGeo.setAttribute('position', new THREE.BufferAttribute(positions, 3));

      const vaporMat = new THREE.PointsMaterial({
        color: 0xf43f5e,
        size: 0.07,
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
      });

      explosionSystem = new THREE.Points(vaporGeo, vaporMat);
      scene.add(explosionSystem);
    };

    // 8. Mouse Parallax Inertia
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
    window.addEventListener('mousemove', handleMouseMove);

    // 9. Resize Handler
    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };
    window.addEventListener('resize', handleResize);

    // 10. Animation Loop
    let animId: number;
    const startTime = performance.now();

    const animate = () => {
      animId = requestAnimationFrame(animate);
      const elapsed = (performance.now() - startTime) * 0.001;

      // Vaporization check
      if (isVaporizingRef.current && !isExploding) {
        triggerVaporization();
      }

      if (isExploding && explosionSystem && explosionVelocities) {
        const positions = explosionSystem.geometry.attributes.position.array as Float32Array;
        for (let i = 0; i < positions.length; i += 3) {
          positions[i] += explosionVelocities[i];
          positions[i + 1] += explosionVelocities[i + 1];
          positions[i + 2] += explosionVelocities[i + 2];
        }
        explosionSystem.geometry.attributes.position.needsUpdate = true;
        const mat = explosionSystem.material as THREE.PointsMaterial;
        mat.opacity = Math.max(0, mat.opacity - 0.007);
      }

      // Parallax smooth lerp
      targetX += (mouseX - targetX) * 0.04;
      targetY += (mouseY - targetY) * 0.04;

      camera.position.x = targetX * 1.4;
      camera.position.y = -targetY * 1.1;
      camera.lookAt(0, 0, 0);

      // Rotation & Gentle Floating
      gemMesh.rotation.x = elapsed * 0.25;
      gemMesh.rotation.y = elapsed * 0.35;
      gemMesh.position.y = 0.2 + Math.sin(elapsed * 1.2) * 0.15;

      torusMesh.rotation.x = elapsed * 0.15;
      torusMesh.rotation.y = elapsed * 0.2;
      torusMesh.position.y = 1.4 + Math.sin(elapsed * 0.9 + 1) * 0.2;

      octaMesh.rotation.x = -elapsed * 0.2;
      octaMesh.rotation.z = elapsed * 0.25;
      octaMesh.position.y = -1.2 + Math.sin(elapsed * 1.1 + 2) * 0.18;

      sphereMesh.position.y = 2.0 + Math.sin(elapsed * 0.8 + 3) * 0.16;
      dodecaMesh.rotation.y = elapsed * 0.18;
      dodecaMesh.position.y = -2.1 + Math.sin(elapsed * 1.3 + 4) * 0.15;

      dustParticles.rotation.y = elapsed * 0.03;

      renderer.render(scene, camera);
    };

    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('resize', handleResize);
      if (container && renderer.domElement && container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
      renderer.dispose();
      scene.clear();
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className={`fixed inset-0 pointer-events-none z-0 overflow-hidden ${className}`}
      style={{
        opacity: isVaporizing ? 0.2 : 0.85,
        transition: 'opacity 0.6s ease',
      }}
    />
  );
}
