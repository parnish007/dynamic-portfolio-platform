// components/three/HeroScene.tsx

"use client";

import React, { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Environment, Html } from "@react-three/drei";
import SceneLights from "./SceneLights";

interface HeroSceneProps {
  modelUrl?: string; // URL to the main 3D model
  fallbackText?: string;
  className?: string;
}

export default function HeroScene({
  modelUrl,
  fallbackText = "3D Preview loading...",
  className = "",
}: HeroSceneProps) {
  return (
    <div className={`relative w-full h-[500px] rounded-xl overflow-hidden ${className}`}>
      <Canvas camera={{ position: [0, 1.5, 5], fov: 50 }}>
        <SceneLights />

        <Suspense
          fallback={
            <Html center>
              <div className="text-zinc-400">{fallbackText}</div>
            </Html>
          }
        >
          {modelUrl ? (
            // Replace with your actual model loader, e.g. <Model url={modelUrl} />
            <primitive object={null} />
          ) : (
            <Html center>
              <div className="text-zinc-400">No 3D model provided</div>
            </Html>
          )}
          <Environment preset="sunset" />
        </Suspense>

        <OrbitControls enablePan={false} enableZoom={true} enableRotate={true} />
      </Canvas>
    </div>
  );
}
