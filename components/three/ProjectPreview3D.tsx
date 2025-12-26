"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { Environment, Html, OrbitControls, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import SceneLights from "./SceneLights";

interface ProjectPreview3DProps {
  modelUrl?: string;
  fallback?: React.ReactNode;
  className?: string;

  heightClassName?: string; // default: "h-64"
  autoRotate?: boolean;
  enableControls?: boolean;
}

function CanvasFallback({ children }: { children: React.ReactNode }) {
  return (
    <Html center>
      <div className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-xs text-zinc-300 shadow">
        {children}
      </div>
    </Html>
  );
}

function FitAndCenterModel({ url }: { url: string }) {
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

    // center at origin
    cloned.position.sub(center);

    // scale to a nice preview size
    const maxAxis = Math.max(size.x, size.y, size.z);
    const target = 1.8;
    const scale = maxAxis > 0 ? target / maxAxis : 1;

    cloned.scale.setScalar(scale);

    return cloned;
  }, [gltf.scene]);

  useMemo(() => {
    invalidate();
    return null;
  }, [invalidate]);

  return <primitive object={scene} />;
}

export default function ProjectPreview3D({
  modelUrl,
  fallback = <div className="text-sm text-zinc-400">3D preview unavailable</div>,
  className = "",
  heightClassName = "h-64",
  autoRotate = true,
  enableControls = true,
}: ProjectPreview3DProps) {
  if (!modelUrl) {
    return <div className={className}>{fallback}</div>;
  }

  return (
    <div
      className={[
        "w-full rounded-xl overflow-hidden border border-zinc-800 bg-zinc-900/20",
        heightClassName,
        className,
      ].join(" ")}
    >
      <Canvas
        camera={{ position: [0, 0.8, 3.2], fov: 50 }}
        dpr={[1, 2]}
        frameloop="demand"
      >
        <SceneLights />

        <Suspense
          fallback={
            <CanvasFallback>
              <span className="text-zinc-300">Loading 3D preview…</span>
            </CanvasFallback>
          }
        >
          <FitAndCenterModel url={modelUrl} />
          <Environment preset="city" />
        </Suspense>

        {enableControls ? (
          <OrbitControls
            enablePan={false}
            enableZoom={true}
            enableRotate={true}
            autoRotate={autoRotate}
            autoRotateSpeed={0.9}
            minDistance={2.0}
            maxDistance={6}
            maxPolarAngle={Math.PI * 0.85}
            onChange={() => {
              // demand rendering: re-render when user interacts
              // (OrbitControls triggers onChange frequently while dragging)
            }}
          />
        ) : null}
      </Canvas>
    </div>
  );
}
