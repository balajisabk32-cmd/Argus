"use client";

import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, MeshDistortMaterial, Float } from "@react-three/drei";
import * as THREE from "three";
import { COLORS } from "@/lib/tokens";

/** The rotating "suit core" — a distorted neon shell + wireframe cage. */
function SuitCore() {
  const group = useRef<THREE.Group>(null);
  const wire = useRef<THREE.Mesh>(null);

  useFrame((_, dt) => {
    if (wire.current) wire.current.rotation.y += dt * 0.15;
  });

  return (
    <group ref={group}>
      <Float speed={1.4} rotationIntensity={0.6} floatIntensity={1.1}>
        <mesh>
          <icosahedronGeometry args={[1.5, 12]} />
          <MeshDistortMaterial
            color={COLORS.miles}
            emissive={COLORS.flux}
            emissiveIntensity={0.4}
            roughness={0.18}
            metalness={0.6}
            distort={0.38}
            speed={1.6}
          />
        </mesh>
        <mesh ref={wire} scale={1.62}>
          <icosahedronGeometry args={[1.5, 1]} />
          <meshBasicMaterial color={COLORS.volt} wireframe transparent opacity={0.35} />
        </mesh>
      </Float>
    </group>
  );
}

export default function TheSuit() {
  return (
    <section
      id="suit"
      className="relative grid min-h-screen grid-cols-1 items-center gap-12 px-[var(--gutter)] py-32 lg:grid-cols-2"
    >
      <div>
        <p className="eyebrow mb-5">01 — The Suit</p>
        <h2 className="font-display text-[var(--step-4)] font-extrabold leading-[0.9] tracking-tightest text-bone">
          WORN BY
          <br />
          <span className="text-gradient">EVERYONE</span>
        </h2>
        <p className="mt-6 max-w-md text-[var(--step-1)] text-ash">
          Drag to inspect the kinetic weave. A living membrane that learns its
          wearer — bio-electric, self-repairing, and impossible to duplicate.
          The suit is not the hero. You are.
        </p>
        <ul className="mt-10 flex flex-wrap gap-3">
          {["Bio-kinetic", "Self-repair", "Multi-verse safe"].map((t) => (
            <li
              key={t}
              className="glass rounded-full px-4 py-2 font-display text-xs uppercase tracking-wider2 text-bone"
            >
              {t}
            </li>
          ))}
        </ul>
      </div>

      {/* Interactive 3D viewer */}
      <div className="relative h-[60vh] min-h-[420px] w-full overflow-hidden rounded-3xl border border-white/10 bg-void">
        <Canvas camera={{ position: [0, 0, 5], fov: 45 }} dpr={[1, 2]}>
          <ambientLight intensity={0.4} />
          <pointLight position={[5, 5, 5]} intensity={60} color={COLORS.volt} />
          <pointLight position={[-5, -3, 2]} intensity={50} color={COLORS.flux} />
          <Suspense fallback={null}>
            <SuitCore />
          </Suspense>
          <OrbitControls
            enablePan={false}
            enableZoom={false}
            autoRotate
            autoRotateSpeed={0.8}
            dampingFactor={0.08}
            enableDamping
          />
        </Canvas>
        <span className="pointer-events-none absolute bottom-4 left-4 font-display text-xs uppercase tracking-wider2 text-ash">
          Drag · Rotate
        </span>
      </div>
    </section>
  );
}
