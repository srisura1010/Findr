"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";

export default function FindrBox() {
  const mountRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!mountRef.current) return;
    const container = mountRef.current;
    const W = container.clientWidth || 520;
    const H = container.clientHeight || 520;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, W / H, 0.1, 200);
    camera.position.set(0, 4, 11);
    camera.lookAt(0, 0, 0);

    scene.add(new THREE.AmbientLight(0xfff8f0, 0.9));
    const sun = new THREE.DirectionalLight(0xfffaf0, 1.5);
    sun.position.set(5, 14, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.width = 1024;
    sun.shadow.mapSize.height = 1024;
    scene.add(sun);
    const fill = new THREE.DirectionalLight(0xd0dcff, 0.55);
    fill.position.set(-6, 4, -4);
    scene.add(fill);

    // ─── ANIMATION TIMELINE CONFIG ───
    // Tells the code what frames in your single Blender animation mean what.
    // Assumes 24fps animation export from Blender.
    const FPS = 24;
    const OPEN_START_FRAME = 0;
    const OPEN_END_FRAME = 90;   // box fully open at frame 90
    const IDLE_END_FRAME = 180;  // idle loop runs from 90 → 180 then repeats

    // Convert frames to seconds (which is how three.js measures animation time)
    const OPEN_START_TIME = OPEN_START_FRAME / FPS; // 0.0s
    const OPEN_END_TIME   = OPEN_END_FRAME   / FPS; // 1.5s
    const IDLE_END_TIME   = IDLE_END_FRAME   / FPS; // 2.5s

    // ─── LOAD GLB ───
    const pivot = new THREE.Group();
    scene.add(pivot);

    let mixer: THREE.AnimationMixer | null = null;
    let action: THREE.AnimationAction | null = null;
    let loaded = false;

    const loader = new GLTFLoader();
    loader.load(
      "/models/findr-box.glb",
      (gltf) => {
        const model = gltf.scene;
        model.traverse((obj) => {
          if (obj instanceof THREE.Mesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;
          }
        });
        pivot.add(model);

        // Single animation clip — frames 0 to 150
        if (gltf.animations.length > 0) {
          mixer = new THREE.AnimationMixer(model);
          action = mixer.clipAction(gltf.animations[0]);
          action.setLoop(THREE.LoopOnce, 1); // we control looping manually
          action.clampWhenFinished = true;
          action.play();
          action.paused = true; // we'll drive .time manually
          action.time = OPEN_START_TIME;
        }

        loaded = true;
      },
      undefined,
      (err) => console.error("Failed to load /models/findr-box.glb:", err)
    );

    // ─── INTERACTION ───
    let yaw = -0.4, targetYaw = -0.4;
    let pitch = 0.25, targetPitch = 0.25;
    let velX = 0, velY = 0;
    let dragging = false, lastMX = 0, lastMY = 0;
    let hovered = false;
    let mode: "closed" | "opening" | "idle" | "closing" = "closed";

    const onDown = (e: MouseEvent) => {
      dragging = true; velX = 0; velY = 0;
      lastMX = e.clientX; lastMY = e.clientY;
      e.preventDefault();
    };
    const onMove = (e: MouseEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lastMX, dy = e.clientY - lastMY;
      targetYaw += dx * 0.013;
      targetPitch += dy * 0.011;
      velX = dx; velY = dy;
      lastMX = e.clientX; lastMY = e.clientY;
    };
    const onUp = () => { dragging = false; };
    const onEnter = () => { hovered = true; };
    const onLeave = () => { hovered = false; dragging = false; };

    let lastTX = 0, lastTY = 0;
    const onTS = (e: TouchEvent) => {
      lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
      velX = 0; velY = 0;
    };
    const onTM = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - lastTX, dy = e.touches[0].clientY - lastTY;
      targetYaw += dx * 0.013;
      targetPitch += dy * 0.011;
      velX = dx; velY = dy;
      lastTX = e.touches[0].clientX; lastTY = e.touches[0].clientY;
      e.preventDefault();
    };

    container.addEventListener("mousedown",  onDown);
    container.addEventListener("mouseenter", onEnter);
    container.addEventListener("mouseleave", onLeave);
    container.addEventListener("touchstart", onTS, { passive: true });
    container.addEventListener("touchmove",  onTM, { passive: false });
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    let raf: number;
    const clock = new THREE.Clock();
    const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

    // Speed of opening/closing scrub, in seconds-per-second.
    // 1.2 = animation plays at real speed. Higher = faster open/close.
    const SCRUB_SPEED = 1.2;

    function animate() {
      raf = requestAnimationFrame(animate);
      const dt = clock.getDelta();

      // Smooth drag + auto-spin
      if (!dragging) {
        velX *= 0.92; velY *= 0.92;
        targetYaw += velX * 0.007;
        targetPitch += velY * 0.005;
        if (Math.abs(velX) < 0.08) targetYaw += 0.005;
      }
      yaw   = lerp(yaw,   targetYaw,   0.09);
      pitch = lerp(pitch, targetPitch, 0.09);
      pivot.rotation.y = yaw;
      pivot.rotation.x = pitch;

      // ─── ANIMATION STATE MACHINE ───
      if (loaded && mixer && action) {

        // Determine next mode based on current state + hover
        if (mode === "closed" && hovered) mode = "opening";
        else if (mode === "opening" && !hovered) mode = "closing";
        else if (mode === "idle" && !hovered) mode = "closing";
        else if (mode === "closing" && hovered) mode = "opening";

        if (mode === "opening") {
          // Advance time toward OPEN_END_TIME
          action.time = Math.min(action.time + dt * SCRUB_SPEED, OPEN_END_TIME);
          if (action.time >= OPEN_END_TIME - 1e-4) {
            // Reached the opened state → start looping the idle section
            action.time = OPEN_END_TIME;
            mode = "idle";
          }
        }
        else if (mode === "idle") {
          // Loop within [OPEN_END_TIME, IDLE_END_TIME]
          let t = action.time + dt * SCRUB_SPEED;
          const loopLen = IDLE_END_TIME - OPEN_END_TIME;
          if (t >= IDLE_END_TIME) {
            // wrap back to the start of the idle region
            t = OPEN_END_TIME + ((t - OPEN_END_TIME) % loopLen);
          }
          action.time = t;
        }
        else if (mode === "closing") {
          // If we left idle mid-loop, snap to OPEN_END_TIME first (the boundary
          // between the open animation and the idle loop) so closing always plays
          // the full open→close motion smoothly.
          if (action.time > OPEN_END_TIME) action.time = OPEN_END_TIME;
          // Scrub backward
          action.time = Math.max(action.time - dt * SCRUB_SPEED, OPEN_START_TIME);
          if (action.time <= OPEN_START_TIME + 1e-4) {
            action.time = OPEN_START_TIME;
            mode = "closed";
          }
        }
        // mode === "closed" → stay at frame 0, nothing to do

        mixer.update(0); // applies pose at action.time without advancing
      }

      renderer.render(scene, camera);
    }
    animate();

    const ro = new ResizeObserver(() => {
      const w = container.clientWidth, h = container.clientHeight;
      renderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
    });
    ro.observe(container);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      container.removeEventListener("mousedown",  onDown);
      container.removeEventListener("mouseenter", onEnter);
      container.removeEventListener("mouseleave", onLeave);
      container.removeEventListener("touchstart", onTS);
      container.removeEventListener("touchmove",  onTM);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      renderer.dispose();
      if (container.contains(renderer.domElement)) container.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: "100%", cursor: "grab" }} />;
}