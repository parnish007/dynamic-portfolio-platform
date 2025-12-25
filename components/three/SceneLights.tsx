// components/three/SceneLights.tsx

import React from "react";
import { useThree } from "@react-three/fiber";

interface SceneLightsProps {
  ambientIntensity?: number;
  directionalIntensity?: number;
  directionalPosition?: [number, number, number];
}

export default function SceneLights({
  ambientIntensity = 0.5,
  directionalIntensity = 1,
  directionalPosition = [5, 5, 5],
}: SceneLightsProps) {
  const { scene } = useThree();

  // Optional: configure scene background if needed
  React.useEffect(() => {
    scene.background = null; // or new THREE.Color("#0f0f0f");
  }, [scene]);

  return (
    <>
      {/* Ambient light: soft overall illumination */}
      <ambientLight intensity={ambientIntensity} />

      {/* Directional light: like sun */}
      <directionalLight
        intensity={directionalIntensity}
        position={directionalPosition}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
      />

      {/* Optional helper lights */}
      {/* <pointLight position={[0, 5, 0]} intensity={0.3} /> */}
    </>
  );
}
