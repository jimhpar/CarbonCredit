"use client";

import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Cloud, CloudRain, Layers, Map as MapIcon } from "lucide-react";
import type { PilotFarm } from "@/types/agrotwin";

interface CloudRegion {
  name: string;
  lat: number;
  lng: number;
  cloud_cover_pct: number;
}

interface FarmMapProps {
  farms: PilotFarm[];
  selectedFarmId: string;
  onSelectFarm: (farm: PilotFarm) => void;
  cloudCoverPct?: number | null;
  heightClass?: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
const CLOUD_MAX_ZOOM = 11; // Above zoom 11 (zoomed in >= 12), camera is below the cloud deck

export default function FarmMap({
  farms,
  selectedFarmId,
  onSelectFarm,
  cloudCoverPct = null,
  heightClass = "h-[340px]",
}: FarmMapProps) {
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerGroupRef = useRef<L.LayerGroup | null>(null);
  const cloudGroupRef = useRef<L.LayerGroup | null>(null);
  const streetLayerRef = useRef<L.TileLayer | null>(null);
  const satLayerRef = useRef<L.TileLayer | null>(null);
  const radarLayerRef = useRef<L.TileLayer | null>(null);

  const [baseMode, setBaseMode] = useState<"street" | "satellite">("satellite");
  const [showRadar, setShowRadar] = useState<boolean>(true);
  const [showClouds, setShowClouds] = useState<boolean>(true);
  const [radarAvailable, setRadarAvailable] = useState<boolean>(false);
  const [currentZoom, setCurrentZoom] = useState<number>(7);
  const [cloudRegions, setCloudRegions] = useState<CloudRegion[]>([]);

  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [23.8103, 89.2],
      zoom: 7,
      zoomControl: true,
    });

    const street = L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: "&copy; OpenStreetMap",
      maxZoom: 18,
    });

    const satellite = L.tileLayer(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
      {
        attribution: "&copy; Esri World Imagery",
        maxZoom: 18,
      }
    );

    satellite.addTo(map);
    streetLayerRef.current = street;
    satLayerRef.current = satellite;
    cloudGroupRef.current = L.layerGroup().addTo(map);
    layerGroupRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    map.on("zoomend", () => {
      if (mapRef.current) setCurrentZoom(mapRef.current.getZoom());
    });

    // Fetch live RainViewer weather radar tile path
    fetch("https://api.rainviewer.com/public/weather-maps.json")
      .then((r) => r.json())
      .then((data) => {
        const past = data?.radar?.past;
        if (Array.isArray(past) && past.length > 0 && mapRef.current) {
          const latest = past[past.length - 1];
          const radar = L.tileLayer(
            `https://tilecache.rainviewer.com${latest.path}/256/{z}/{x}/{y}/2/1_1.png`,
            {
              opacity: 0.55,
              maxNativeZoom: 7,
              maxZoom: 18,
              attribution: "RainViewer Radar",
            }
          );
          radar.addTo(mapRef.current);
          radarLayerRef.current = radar;
          setRadarAvailable(true);
        }
      })
      .catch(() => {
        setRadarAvailable(false);
      });

    // Fetch regional live cloud cover grid across Bangladesh
    fetch(`${API_BASE}/api/weather/cloud-grid`)
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data?.regions)) setCloudRegions(data.regions);
      })
      .catch(() => {
        // ignore
      });

    // Fetch Bangladesh border GeoJSON and draw red outline
    fetch(`${API_BASE}/api/geo/bangladesh-border`)
      .then((r) => r.json())
      .then((geojson) => {
        if (geojson && mapRef.current) {
          L.geoJSON(geojson, {
            style: {
              color: "#ef4444",
              weight: 2.5,
              opacity: 0.9,
              fillColor: "#ef4444",
              fillOpacity: 0.03,
            },
            interactive: false,
          }).addTo(mapRef.current);
        }
      })
      .catch(() => {
        // ignore
      });

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Switch Street / Satellite base map
  useEffect(() => {
    const map = mapRef.current;
    const street = streetLayerRef.current;
    const sat = satLayerRef.current;
    if (!map || !street || !sat) return;

    if (baseMode === "satellite") {
      if (map.hasLayer(street)) map.removeLayer(street);
      if (!map.hasLayer(sat)) sat.addTo(map);
    } else {
      if (map.hasLayer(sat)) map.removeLayer(sat);
      if (!map.hasLayer(street)) street.addTo(map);
    }
  }, [baseMode]);

  // Toggle Weather Radar overlay
  useEffect(() => {
    const map = mapRef.current;
    const radar = radarLayerRef.current;
    if (!map || !radar) return;
    if (showRadar) {
      if (!map.hasLayer(radar)) radar.addTo(map);
    } else {
      if (map.hasLayer(radar)) map.removeLayer(radar);
    }
  }, [showRadar]);

  // Render geographically anchored, density-aware clouds ONLY below zoom 12 (above cloud deck)
  useEffect(() => {
    const group = cloudGroupRef.current;
    if (!group) return;
    group.clearLayers();

    if (!showClouds || currentZoom > CLOUD_MAX_ZOOM) return;

    cloudRegions.forEach((reg, idx) => {
      const cc = reg.cloud_cover_pct;
      if (cc < 15) return;

      const density = cc / 100; // 0.15 .. 1.0
      // Outer soft cloud bank + denser inner puffs proportional to regional cloud %
      const puffs = [
        { dLat: 0.0, dLng: 0.0, radius: 38000 + density * 28000, op: 0.18 * density },
        { dLat: 0.16, dLng: -0.18, radius: 26000 + density * 20000, op: 0.28 * density },
        { dLat: -0.14, dLng: 0.21, radius: 24000 + density * 18000, op: 0.26 * density },
        {
          dLat: (idx % 2 === 0 ? 1 : -1) * 0.08,
          dLng: (idx % 2 === 0 ? 1 : -1) * 0.09,
          radius: 16000 + density * 16000,
          op: cc >= 75 ? 0.48 : 0.25 * density,
        },
      ];

      puffs.forEach((puff) => {
        L.circle([reg.lat + puff.dLat, reg.lng + puff.dLng], {
          radius: puff.radius,
          stroke: false,
          fillColor: cc >= 75 ? "#ffffff" : "#f1f5f9",
          fillOpacity: puff.op,
          interactive: false,
        }).addTo(group);
      });
    });
  }, [showClouds, currentZoom, cloudRegions]);

  // Draw farm polygons & markers
  useEffect(() => {
    const map = mapRef.current;
    const group = layerGroupRef.current;
    if (!map || !group) return;

    group.clearLayers();

    farms.forEach((farm) => {
      const isSelected = farm.id === selectedFarmId;
      const color = isSelected ? "#10b981" : "#38bdf8";

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

  const belowClouds = currentZoom > CLOUD_MAX_ZOOM;

  return (
    <div className="relative h-full min-h-[540px]">
      {/* Map Controls Overlay */}
      <div className="absolute right-3 top-3 z-[400] flex flex-wrap items-center gap-1.5 rounded-lg border border-slate-200 bg-white/95 p-1 shadow-md text-xs">
        <button
          type="button"
          onClick={() => setBaseMode("street")}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
            baseMode === "street"
              ? "bg-slate-900 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <MapIcon className="h-3.5 w-3.5" /> Street
        </button>
        <button
          type="button"
          onClick={() => setBaseMode("satellite")}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
            baseMode === "satellite"
              ? "bg-emerald-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Layers className="h-3.5 w-3.5" /> Satellite
        </button>
        <button
          type="button"
          onClick={() => setShowRadar((prev) => !prev)}
          title={radarAvailable ? "Toggle Live Rain Radar" : "Radar loading"}
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
            showRadar
              ? "bg-sky-600 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <CloudRain className="h-3.5 w-3.5" /> Radar
        </button>
        <button
          type="button"
          onClick={() => setShowClouds((prev) => !prev)}
          title="Clouds are visible at regional altitude (zoom <= 11) and clear automatically when zoomed in"
          className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 font-medium transition ${
            showClouds && !belowClouds
              ? "bg-slate-700 text-white"
              : "text-slate-600 hover:bg-slate-100"
          }`}
        >
          <Cloud className="h-3.5 w-3.5" />
          {belowClouds
            ? "Below Clouds"
            : `Clouds${cloudCoverPct != null ? ` (${cloudCoverPct}%)` : ""}`}
        </button>
      </div>

      <div
        ref={mapContainerRef}
        className={`${heightClass} w-full rounded-xl border border-slate-200 shadow-sm overflow-hidden z-0`}
      />
    </div>
  );
}
