"use client";

import React, { Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Html, useGLTF } from "@react-three/drei";
import * as THREE from "three";

import SceneLights from "./SceneLights";

interface Card3DProps {
  modelUrl?: string;
  fallback?: React.ReactNode;
  className?: string;

  autoRotate?: boolean;
  heightClassName?: string; // e.g. "h-64"
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

function Model({ url }: { url: string }) {
  const gltf = useGLTF(url);

  const scene = useMemo(() => {
    // Clone so multiple cards can reuse same model safely
    const cloned = gltf.scene.clone(true);

    // Ensure meshes cast/receive shadow if you later enable shadows
    cloned.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const m = obj as THREE.Mesh;
        m.castShadow = true;
        m.receiveShadow = true;
      }
    });

    // Center + scale to fit into view
    const box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();

    box.getSize(size);
    box.getCenter(center);

    cloned.position.sub(center);

    const maxAxis = Math.max(size.x, size.y, size.z);
    const targetSize = 1.6; // tweak if you want bigger/smaller
    const scale = maxAxis > 0 ? targetSize / maxAxis : 1;

    cloned.scale.setScalar(scale);

    return cloned;
  }, [gltf.scene]);

  return <primitive object={scene} />;
}

export default function Card3D({
  modelUrl,
  fallback = <div className="text-zinc-400 text-sm">3D preview loading...</div>,
  className = "",
  autoRotate = true,
  heightClassName = "h-64",
}: Card3DProps) {
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
        camera={{ position: [0, 0.6, 2.4], fov: 45 }}
        dpr={[1, 2]}
      >
        <SceneLights />

        <Suspense fallback={<CanvasFallback>{fallback}</CanvasFallback>}>
          <Model url={modelUrl} />
          <Environment preset="city" />
        </Suspense>

        <OrbitControls
          enablePan={false}
          enableZoom={true}
          enableRotate={true}
          autoRotate={autoRotate}
          autoRotateSpeed={0.8}
          minDistance={1.2}
          maxDistance={5}
          maxPolarAngle={Math.PI * 0.85}
        />
      </Canvas>
    </div>
  );
}

// Optional: helps drei cache GLTFs
useGLTF.preload;
