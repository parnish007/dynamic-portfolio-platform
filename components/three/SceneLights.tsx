"use client";

import React from "react";
import * as THREE from "three";

interface SceneLightsProps {
  ambientIntensity?: number;
  keyIntensity?: number;
  fillIntensity?: number;
  rimIntensity?: number;
}

export default function SceneLights({
  ambientIntensity = 0.35,
  keyIntensity = 1.1,
  fillIntensity = 0.4,
  rimIntensity = 0.6,
}: SceneLightsProps) {
  return (
    <>
      {/* ---------------------------------------------------------------- */}
      {/* Ambient — base visibility (kept low to preserve contrast)         */}
      {/* ---------------------------------------------------------------- */}
      <ambientLight intensity={ambientIntensity} />

      {/* ---------------------------------------------------------------- */}
      {/* Key Light — main light source (soft directional)                  */}
      {/* ---------------------------------------------------------------- */}
      <directionalLight
        position={[4, 6, 4]}
        intensity={keyIntensity}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.1}
        shadow-camera-far={20}
        shadow-camera-left={-6}
        shadow-camera-right={6}
        shadow-camera-top={6}
        shadow-camera-bottom={-6}
        shadow-bias={-0.0005}
      />

      {/* ---------------------------------------------------------------- */}
      {/* Fill Light — softens harsh shadows                                */}
      {/* ---------------------------------------------------------------- */}
      <directionalLight
        position={[-4, 3, -2]}
        intensity={fillIntensity}
        color={new THREE.Color("#e5e7eb")} // neutral cool fill
      />

      {/* ---------------------------------------------------------------- */}
      {/* Rim / Back Light — separation from background                     */}
      {/* ---------------------------------------------------------------- */}
      <directionalLight
        position={[0, 5, -6]}
        intensity={rimIntensity}
        color={new THREE.Color("#ffffff")}
      />
    </>
  );
}
