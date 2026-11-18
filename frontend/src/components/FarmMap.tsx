"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { PilotFarm } from "@/types/agrotwin";

interface FarmMapProps {
  farms: PilotFarm[];
  selectedFarmId: string;
  onSelectFarm: (farm: PilotFarm) => void;
}

export default function FarmMap({ farms, selectedFarmId, onSelectFarm }: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.8103, 89.2],
      zoom: 7,
      zoomControl: true,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap contributors",
      maxZoom: 18,
    }).addTo(map);

    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    farms.forEach((farm) => {
      const isSelected = farm.id === selectedFarmId;
      const color = isSelected ? "#10b981" : "#3b82f6";

      const poly = L.polygon(farm.polygon, {
        color,
        weight: isSelected ? 3 : 2,
        fillColor: color,
        fillOpacity: isSelected ? 0.45 : 0.25,
      });

      poly.bindTooltip(`${farm.name} (${farm.district})`, { sticky: true });
      poly.on("click", () => onSelectFarm(farm));
      poly.addTo(group);

      const marker = L.circleMarker(farm.center, {
        radius: isSelected ? 9 : 6,
        color: "#ffffff",
        weight: 2,
        fillColor: color,
        fillOpacity: 1,
      });
      marker.on("click", () => onSelectFarm(farm));
      marker.addTo(group);

      if (isSelected) {
        map.flyTo(farm.center, 14, { duration: 0.8 });
      }
    });
  }, [farms, selectedFarmId, onSelectFarm]);

  return (
    <div
      ref={mapContainerRef}
      className="h-[340px] w-full rounded-xl border border-slate-800 overflow-hidden z-0"
    />
  );
}
