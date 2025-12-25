// components/three/Card3D.tsx

"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import SceneLights from "./SceneLights";

interface Card3DProps {
  modelUrl?: string; // URL to 3D model (glTF/GLB)
  fallback?: React.ReactNode;
  className?: string;
}

export default function Card3D({
  modelUrl,
  fallback = <div className="text-zinc-400 text-sm">3D preview loading...</div>,
  className = "",
}: Card3DProps) {
  if (!modelUrl) return <div className={className}>{fallback}</div>;

  return (
    <div className={`w-full h-64 rounded-xl overflow-hidden bg-zinc-900/20 ${className}`}>
      <Canvas camera={{ position: [0, 1, 3], fov: 45 }}>
        <SceneLights />

        <Suspense fallback={fallback}>
          {/* Replace with actual model loader */}
          <primitive object={null} />
          <Environment preset="city" />
        </Suspense>

        <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
