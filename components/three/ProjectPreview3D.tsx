// components/three/ProjectPreview3D.tsx

import React from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import SceneLights from "./SceneLights";

interface ProjectPreview3DProps {
  modelUrl?: string; // URL to glTF/GLB model
  fallback?: React.ReactNode;
  className?: string;
}

export default function ProjectPreview3D({
  modelUrl,
  fallback = <div className="text-sm text-zinc-400">3D preview unavailable</div>,
  className = "",
}: ProjectPreview3DProps) {
  if (!modelUrl) return <div className={className}>{fallback}</div>;

  return (
    <div className={`w-full h-64 rounded-xl overflow-hidden bg-zinc-900/20 ${className}`}>
      <Canvas camera={{ position: [0, 1, 3], fov: 50 }}>
        <SceneLights />

        <Suspense fallback={fallback}>
          {/* Load 3D model */}
          <primitive object={null} /> {/* Replace null with actual loaded model */}
          <Environment preset="city" />
        </Suspense>

        <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
