"use client";

import { Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Canvas, useThree, useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { gsap } from "@/lib/gsap";
import { COLORS, clamp, easeInCubic, easeInQuad, lerp, mulberry32 } from "@/lib/tokens";

/* ------------------------------------------------------------------ *
 *  CITY CANYON — instanced skyscrapers forming a dive-able corridor
 * ------------------------------------------------------------------ */
function CityCanyon() {
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const rand = useRef(mulberry32(20240715));
  const COUNT = 60;

  useLayoutEffect(() => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    const r = rand.current;

    for (let i = 0; i < COUNT; i++) {
      const side = i % 2 === 0 ? -1 : 1;
      const slot = Math.floor(i / 2);
      const z = 60 - slot * 11 + (r() - 0.5) * 4; // travel away from camera
      const x = side * (16 + r() * 16);
      const w = 6 + r() * 10;
      const d = 6 + r() * 10;
      const h = 40 + r() * 130;
      const bottom = -60;
      p.set(x, bottom + h / 2, z);
      s.set(w, h, d);
      m.compose(p, q, s);
      mesh.setMatrixAt(i, m);
    }
    mesh.instanceMatrix.needsUpdate = true;
  }, []);

  // Gentle neon emissive breathing on the windows
  useFrame(({ clock }) => {
    const mesh = meshRef.current;
    if (!mesh) return;
    const pulse = 0.35 + Math.sin(clock.elapsedTime * 1.2) * 0.15;
    (mesh.material as THREE.MeshStandardMaterial).emissiveIntensity = pulse;
  });

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, COUNT]} castShadow>
      <boxGeometry args={[1, 1, 1]} />
      <meshStandardMaterial
        color="#0c0c14"
        emissive={COLORS.volt}
        emissiveIntensity={0.35}
        metalness={0.35}
        roughness={0.65}
      />
    </instancedMesh>
  );
}

/* ------------------------------------------------------------------ *
 *  THE WEB — a thin strand that shoots toward the screen on the pull
 * ------------------------------------------------------------------ */
function WebStrand({ webRef }: { webRef: React.RefObject<THREE.Group> }) {
  return (
    <group ref={webRef} visible={false}>
      {/* main strand */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.06, 0.18, 1, 8]} />
        <meshBasicMaterial color={COLORS.bone} toneMapped={false} />
      </mesh>
      {/* droplet at the leading tip */}
      <mesh position={[0, 0.5, 0]}>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial color={COLORS.volt} toneMapped={false} />
      </mesh>
    </group>
  );
}

/* ------------------------------------------------------------------ *
 *  CAMERA CHOREOGRAPHY — the real dive + pull-in math
 * ------------------------------------------------------------------ */
function Rig({
  webRef,
  flashRef,
  onComplete,
}: {
  webRef: React.RefObject<THREE.Group>;
  flashRef: React.RefObject<HTMLDivElement>;
  onComplete: () => void;
}) {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const progress = useRef({ t: 0 });
  const webTriggered = useRef(false);

  useLayoutEffect(() => {
    camera.position.set(0, 34, 70);
    camera.fov = 62;
    camera.near = 0.1;
    camera.far = 600;
    camera.updateProjectionMatrix();
  }, [camera]);

  useEffect(() => {
    const update = () => {
      const t = progress.current.t; // 0..1 normalized timeline

      // --- Vertical dive (ease-in so it accelerates downward) ---
      const y = lerp(34, -18, easeInQuad(t));
      // --- Forward plunge (ease-in-cubic → dramatic acceleration) ---
      const z = lerp(70, -200, easeInCubic(t));
      // --- Lateral weave that tightens as we descend ---
      const x = Math.sin(t * Math.PI * 2.2) * 7 * (1 - t);

      camera.position.set(x, y, z);
      // Always look ahead and slightly down the canyon
      camera.lookAt(0, y - 14, z - 40);
      // Subtle roll for that "off-balance swing" energy
      camera.rotation.z += Math.sin(t * Math.PI * 3) * 0.05 * (1 - t);

      // --- WEB PULL-IN (final 22% of the dive) ---
      const webGrow = clamp((t - 0.78) / 0.22, 0, 1);
      const web = webRef.current;
      if (web) {
        if (webGrow > 0) {
          web.visible = true;
          const len = lerp(2, 90, easeInCubic(webGrow));
          const nearZ = camera.position.z; // tip reaches the viewer
          web.position.set(4.5, 2.5, nearZ - len / 2);
          web.scale.set(1, len, 1);
          // extra yank: lurch the camera forward as the web connects
          camera.position.z += webGrow * 26;
        } else if (!webTriggered.current) {
          web.visible = false;
        }
      }

      // --- Flash to white at the very end (transition to hero) ---
      const flash = clamp((t - 0.95) / 0.05, 0, 1);
      if (flashRef.current) flashRef.current.style.opacity = String(flash);
    };

    const tl = gsap.timeline({ onComplete });
    tl.to(progress.current, {
      t: 1,
      duration: 4.6,
      ease: "none",
      onUpdate: update,
    });
    return () => {
      tl.kill();
    };
  }, [camera, webRef, flashRef, onComplete]);

  return null;
}

/* ------------------------------------------------------------------ *
 *  EXPORTED INTRO — Canvas + flash overlay + handoff
 * ------------------------------------------------------------------ */
export default function HeroIntro({ onComplete }: { onComplete: () => void }) {
  const webRef = useRef<THREE.Group>(null);
  const flashRef = useRef<HTMLDivElement>(null);
  const [leaving, setLeaving] = useState(false);

  const handleDone = () => {
    setLeaving(true);
    // fade the canvas away, then unmount via parent state
    gsap.to(flashRef.current, {
      opacity: 0,
      duration: 0.4,
      delay: 0.15,
    });
    onComplete();
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-ink transition-opacity duration-700"
      style={{ opacity: leaving ? 0 : 1, pointerEvents: leaving ? "none" : "auto" }}
    >
      <Canvas
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        camera={{ position: [0, 34, 70], fov: 62 }}
      >
        <color attach="background" args={[COLORS.ink]} />
        <fogExp2 attach="fog" args={[COLORS.ink, 0.011]} />

        {/* Cinematic neon rim lighting */}
        <ambientLight intensity={0.25} />
        <directionalLight position={[10, 30, 10]} intensity={0.6} color={COLORS.bone} />
        <pointLight position={[-30, 10, 0]} intensity={120} color={COLORS.volt} distance={120} />
        <pointLight position={[30, -5, -40]} intensity={140} color={COLORS.flux} distance={140} />

        <Suspense fallback={null}>
          <CityCanyon />
          <WebStrand webRef={webRef} />
        </Suspense>

        <Rig webRef={webRef} flashRef={flashRef} onComplete={handleDone} />
      </Canvas>

      {/* white flash overlay for the pull-in cut */}
      <div
        ref={flashRef}
        className="pointer-events-none absolute inset-0 bg-bone"
        style={{ opacity: 0 }}
      />
    </div>
  );
}
