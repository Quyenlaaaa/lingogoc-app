import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';

const ACTIVE_STATES = new Set(['listening', 'transcribing', 'thinking', 'streaming', 'speaking', 'reconnecting']);

function material(color, roughness = 0.72) {
  return new THREE.MeshStandardMaterial({ color, roughness, metalness: 0.04 });
}

function mesh(geometry, meshMaterial, position, scale = [1, 1, 1]) {
  const value = new THREE.Mesh(geometry, meshMaterial);
  value.position.set(...position);
  value.scale.set(...scale);
  return value;
}

export default function SpeakingAvatarCanvas({ state, onFallback }) {
  const hostRef = useRef(null);
  const stateRef = useRef(state);

  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
    } catch {
      onFallback?.('webgl-unavailable');
      return undefined;
    }

    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.className = 'speaking-avatar-canvas';
    renderer.domElement.setAttribute('aria-hidden', 'true');
    host.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 30);
    camera.position.set(0, 0.25, 6.2);
    const tutor = new THREE.Group();
    tutor.rotation.y = -0.13;
    scene.add(tutor);

    const skin = material(0xd99b76);
    const hair = material(0x17182b, 0.86);
    const jacket = material(0x4338ca, 0.58);
    const dark = material(0x161320, 0.8);
    const mouthMaterial = material(0x8f3f50, 0.7);
    const head = mesh(new THREE.SphereGeometry(0.73, 28, 20), skin, [0, 0.52, 0], [0.86, 1.06, 0.84]);
    const hairCap = mesh(new THREE.SphereGeometry(0.75, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.54), hair, [0, 0.68, -0.01], [0.9, 1, 0.88]);
    const neck = mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.46, 16), skin, [0, -0.18, 0]);
    const body = mesh(new THREE.CapsuleGeometry(0.72, 0.7, 6, 16), jacket, [0, -0.95, 0], [1.18, 0.9, 0.66]);
    const leftEye = mesh(new THREE.SphereGeometry(0.065, 12, 8), dark, [-0.25, 0.61, 0.62], [1, 0.72, 0.5]);
    const rightEye = leftEye.clone();
    rightEye.position.x = 0.25;
    const nose = mesh(new THREE.ConeGeometry(0.065, 0.22, 10), skin, [0, 0.39, 0.69], [0.7, 1, 0.75]);
    nose.rotation.x = Math.PI / 2;
    const mouth = mesh(new THREE.SphereGeometry(0.13, 14, 8), mouthMaterial, [0, 0.17, 0.63], [1, 0.18, 0.35]);
    tutor.add(body, neck, head, hairCap, leftEye, rightEye, nose, mouth);

    scene.add(new THREE.HemisphereLight(0xdbeafe, 0x312e81, 2.25));
    const keyLight = new THREE.DirectionalLight(0xffffff, 2.4);
    keyLight.position.set(2.8, 3.5, 4.5);
    scene.add(keyLight);
    const rimLight = new THREE.DirectionalLight(0x818cf8, 1.8);
    rimLight.position.set(-3, 1, -1);
    scene.add(rimLight);

    let frameId = 0;
    let disposed = false;
    let sampleStartedAt = performance.now();
    let sampledFrames = 0;
    const startedAt = performance.now();
    const resize = () => {
      const width = Math.max(1, host.clientWidth);
      const height = Math.max(1, host.clientHeight);
      renderer.setSize(width, height, false);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(host);
    resize();

    const contextLost = (event) => {
      event.preventDefault();
      onFallback?.('webgl-context-lost');
    };
    renderer.domElement.addEventListener('webglcontextlost', contextLost, false);

    const render = (now) => {
      if (disposed) return;
      const current = stateRef.current;
      const seconds = now / 1000;
      if (!document.hidden) {
        const active = ACTIVE_STATES.has(current);
        tutor.position.y = active ? Math.sin(seconds * 1.7) * 0.025 : 0;
        tutor.rotation.z = ['thinking', 'streaming', 'reconnecting'].includes(current) ? Math.sin(seconds * 1.25) * 0.025 : 0;
        const speaking = current === 'speaking';
        mouth.scale.y = speaking ? 0.35 + Math.abs(Math.sin(seconds * 13)) * 1.15 : 0.18;
        mouth.scale.x = speaking ? 0.88 : 1;
        const listening = current === 'listening' || current === 'transcribing';
        leftEye.scale.y = rightEye.scale.y = listening ? 0.9 : 0.72;
        renderer.render(scene, camera);
        sampledFrames += 1;
      }
      if (document.hidden) {
        sampleStartedAt = now;
        sampledFrames = 0;
      } else if (now - sampleStartedAt >= 5000) {
        const fps = sampledFrames * 1000 / (now - sampleStartedAt);
        if (now - startedAt >= 5000 && fps < 20) {
          onFallback?.('sustained-low-fps');
          return;
        }
        sampleStartedAt = now;
        sampledFrames = 0;
      }
      frameId = requestAnimationFrame(render);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', contextLost);
      tutor.traverse((object) => {
        object.geometry?.dispose?.();
        if (Array.isArray(object.material)) object.material.forEach((item) => item.dispose?.());
        else object.material?.dispose?.();
      });
      renderer.dispose();
      renderer.forceContextLoss();
      renderer.domElement.remove();
    };
  }, [onFallback]);

  return <div ref={hostRef} className="speaking-avatar-webgl" />;
}
