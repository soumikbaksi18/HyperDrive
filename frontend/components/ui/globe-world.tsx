"use client";

import { Suspense, useEffect, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import ThreeGlobe from "three-globe";
import * as THREE from "three";
import globeData from "@/data/globe.json";

export interface GlobeConfig {
  pointSize?: number;
  globeColor?: string;
  showAtmosphere?: boolean;
  atmosphereColor?: string;
  atmosphereAltitude?: number;
  emissive?: string;
  emissiveIntensity?: number;
  shininess?: number;
  polygonColor?: string;
  ambientLight?: string;
  directionalLeftLight?: string;
  directionalTopLight?: string;
  pointLight?: string;
  arcTime?: number;
  arcLength?: number;
  initialPosition?: { lat: number; lng: number };
  autoRotate?: boolean;
  autoRotateSpeed?: number;
}

export interface GlobeArc {
  order: number;
  startLat: number;
  startLng: number;
  endLat: number;
  endLng: number;
  arcAlt: number;
  color: string;
}

export const HYPERDRIVE_GLOBE_CONFIG: GlobeConfig = {
  globeColor: "#1a0b33",
  showAtmosphere: true,
  atmosphereColor: "rgba(167, 139, 250, 0.42)",
  atmosphereAltitude: 0.14,
  emissive: "#2e1065",
  emissiveIntensity: 0.18,
  shininess: 0.85,
  polygonColor: "rgba(139, 92, 246, 0.5)",
  ambientLight: "#c4b5fd",
  directionalLeftLight: "#f5f3ff",
  directionalTopLight: "#ddd6fe",
  pointLight: "#a78bfa",
  arcTime: 2000,
  arcLength: 0.9,
  initialPosition: { lat: 25, lng: 45 },
  autoRotate: true,
  autoRotateSpeed: 0.32,
};

function WorldInner({ globeConfig, data }: { globeConfig: GlobeConfig; data: GlobeArc[] }) {
  const globe = useMemo(() => {
    const g = new ThreeGlobe({ animateIn: false })
      .showGlobe(true)
      .showAtmosphere(globeConfig.showAtmosphere ?? true)
      .atmosphereColor(globeConfig.atmosphereColor ?? "#a78bfa")
      .atmosphereAltitude(globeConfig.atmosphereAltitude ?? 0.12);

    const globeMaterial = new THREE.MeshPhongMaterial();
    globeMaterial.color = new THREE.Color(globeConfig.globeColor ?? "#1a0b33");
    globeMaterial.emissive = new THREE.Color(globeConfig.emissive ?? "#2e1065");
    globeMaterial.emissiveIntensity = globeConfig.emissiveIntensity ?? 0.15;
    globeMaterial.shininess = globeConfig.shininess ?? 0.9;
    g.globeMaterial(globeMaterial);

    const features = (globeData as { features: object[] }).features;
    g.polygonsData(features);
    g.polygonCapColor(() => globeConfig.polygonColor ?? "rgba(139, 92, 246, 0.5)");
    g.polygonSideColor(() => "rgba(0,0,0,0)");
    g.polygonAltitude(0);
    g.polygonCapCurvatureResolution(2);
    g.globeCurvatureResolution(2);

    g.arcsData(data);
    g.arcColor((d: { color?: string }) => d.color ?? "#a78bfa");
    g.arcAltitude((d: { arcAlt?: number }) => d.arcAlt ?? 0.28);
    g.arcStroke(0.42);
    g.arcDashLength(globeConfig.arcLength ?? 0.9);
    g.arcDashGap(1 - (globeConfig.arcLength ?? 0.9));
    g.arcDashAnimateTime(globeConfig.arcTime ?? 1000);

    const { lat, lng } = globeConfig.initialPosition ?? { lat: 25, lng: 45 };
    g.rotation.y = (-lng * Math.PI) / 180;
    g.rotation.x = (lat * Math.PI) / 180;

    return g;
    // eslint-disable-next-line react-hooks/exhaustive-deps -- globe mesh is created once; arcs update in useEffect
  }, []);

  useEffect(() => {
    globe.arcsData(data);
    globe.arcStroke(0.42);
    globe.arcAltitude((d: { arcAlt?: number }) => d.arcAlt ?? 0.28);
    globe.arcDashAnimateTime(globeConfig.arcTime ?? 1000);
    globe.arcDashLength(globeConfig.arcLength ?? 0.9);
    globe.arcDashGap(1 - (globeConfig.arcLength ?? 0.9));
    globe.showAtmosphere(globeConfig.showAtmosphere ?? true);
    globe.atmosphereColor(globeConfig.atmosphereColor ?? "#a78bfa");
  }, [globe, data, globeConfig]);

  return <primitive object={globe} />;
}

export function World({
  globeConfig = HYPERDRIVE_GLOBE_CONFIG,
  data = [],
  className = "",
}: {
  globeConfig?: GlobeConfig;
  data?: GlobeArc[];
  className?: string;
}) {
  return (
    <div className={`absolute inset-0 h-full w-full ${className}`}>
      <Canvas
        camera={{ position: [0, 0, 400], fov: 45 }}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => gl.setClearColor(0x000000, 0)}
      >
        <ambientLight intensity={1} color={globeConfig.ambientLight} />
        <directionalLight position={[10, 10, 10]} intensity={1} color={globeConfig.directionalTopLight} />
        <directionalLight position={[-10, -10, -10]} intensity={0.5} color={globeConfig.directionalLeftLight} />
        <pointLight position={[0, 0, 200]} intensity={1} color={globeConfig.pointLight} />
        <Suspense fallback={null}>
          <WorldInner globeConfig={globeConfig} data={data} />
        </Suspense>
        <OrbitControls
          enableRotate
          enableZoom
          enablePan
          zoomSpeed={0.8}
          panSpeed={0.6}
          rotateSpeed={0.6}
          minDistance={180}
          maxDistance={700}
          autoRotate={globeConfig.autoRotate ?? true}
          autoRotateSpeed={globeConfig.autoRotateSpeed ?? 0.32}
        />
      </Canvas>
    </div>
  );
}
