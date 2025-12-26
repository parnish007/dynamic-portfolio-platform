"use client";

import React, { Suspense, useMemo, useRef } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import SceneLights from "./SceneLights";

interface HeroSceneProps {
  modelUrl?: string;
  fallbackText?: string;
  className?: string;

  heightClassName?: string; // default: "h-[500px]"
  autoRotate?: boolean;
  enableControls?: boolean;
}

function CanvasFallback({ text }: { text: string }) {
  return (
    <Html center>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 shadow">
        {text}
      </div>
    </Html>
  );
}

function FitAndCenter({ url }: { url: string }) {
  const gltf = useGLTF(url);
  const { invalidate } = useThree();

  const scene = useMemo(() => {
    const cloned = gltf.scene.clone(true);

    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
      }
    });

    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    // Move model to origin
    cloned.position.sub(center);

    // Scale to target hero size
    const maxAxis = Math.max(size.x, size.y, size.z);
    const target = 2.4;
    const scale = maxAxis > 0 ? target / maxAxis : 1;

    cloned.scale.setScalar(scale);

    return cloned;
  }, [gltf.scene]);

  // Ensure a render happens after model is ready (frameloop demand)
  useMemo(() => {
    invalidate();
    return null;
  }, [invalidate]);

  return <primitive object={scene} />;
}

export default function HeroScene({
  modelUrl,
  fallbackText = "3D Preview loading...",
  className = "",
  heightClassName = "h-[500px]",
  autoRotate = true,
  enableControls = true,
}: HeroSceneProps) {
  return (
    <div
      className={[
        "relative w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/20",
        heightClassName,
        className,
      ].join(" ")}
    >
      <Canvas
        camera={{ position: [0, 0.9, 3.6], fov: 50 }}
        dpr={[1, 2]}
        frameloop="demand"
      >
        <SceneLights />

        {!modelUrl ? (
          <CanvasFallback text="No 3D model provided" />
        ) : (
          <Suspense fallback={<CanvasFallback text={fallbackText} />}>
            <FitAndCenter url={modelUrl} />
            <Environment preset="sunset" />
          </Suspense>
        )}

        {enableControls ? (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            autoRotate={autoRotate}
            autoRotateSpeed={0.8}
            minDistance={2.2}
            maxDistance={6}
            maxPolarAngle={Math.PI * 0.85}
            onChange={(e) => {
              // demand rendering: re-render on interaction
              // (OrbitControls calls onChange frequently while dragging)
              (e?.target as any)?.object && (e.target as any).dispatchEvent?.({ type: "change" });
            }}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
