"use client";

import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Cpu,
  Globe,
  Leaf,
  MapPin,
  Radio,
  Satellite,
  ShieldCheck,
  Sprout,
} from "lucide-react";
import type { HybridAnalysis, PilotFarm, PracticeType } from "@/types/agrotwin";

const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[340px] w-full rounded-xl border border-slate-800 bg-slate-900/60 flex items-center justify-center text-slate-400 text-sm">
      Loading Bangladesh GIS Map...
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

export default function Home() {
  const [farms, setFarms] = useState<PilotFarm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<PilotFarm | null>(null);
  const [analysis, setAnalysis] = useState<HybridAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iotStatus, setIotStatus] = useState<string | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [satProvider, setSatProvider] = useState<string>("Checking...");

  // Interactive simulator controls
  const [areaAcres, setAreaAcres] = useState<number>(65);
  const [practice, setPractice] = useState<PracticeType>("AWD_RICE");
  const [soilMoisture, setSoilMoisture] = useState<number>(54);
  const [salinity, setSalinity] = useState<number>(0.6);
  const [waterLevel, setWaterLevel] = useState<number>(-7.5);

  const loadFarms = async () => {
    try {
      setLoading(true);
      const res = await fetch(`${API_BASE}/api/farms`);
      if (!res.ok) throw new Error(`Backend HTTP ${res.status}`);
      const data = await res.json();
      setFarms(data.farms || []);
      setSupabaseConnected(Boolean(data.supabase_connected));
      setSatProvider(data.satellite_provider || "Simulation");
      if (data.farms?.length > 0) {
        const first: PilotFarm = data.farms[0];
        setSelectedFarm(first);
        setAnalysis(first.analysis);
        setAreaAcres(first.area_acres);
        setPractice(first.practice);
        setSoilMoisture(first.iot.soil_moisture_pct);
        setSalinity(first.iot.salinity_dsm);
        setWaterLevel(first.iot.water_level_cm);
      }
      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? `Could not connect to FastAPI backend at ${API_BASE} (${err.message}). Start backend first.`
          : "Failed to load farms."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFarms();
  }, []);

  const handleSelectFarm = (farm: PilotFarm) => {
    setSelectedFarm(farm);
    setAnalysis(farm.analysis);
    setAreaAcres(farm.area_acres);
    setPractice(farm.practice);
    setSoilMoisture(farm.iot.soil_moisture_pct);
    setSalinity(farm.iot.salinity_dsm);
    setWaterLevel(farm.iot.water_level_cm);
    setIotStatus(null);
  };

  const handleRunSimulation = async () => {
    if (!selectedFarm) return;
    try {
      setAnalyzing(true);
      const res = await fetch(`${API_BASE}/api/analyze-farm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: selectedFarm.id,
          name: selectedFarm.name,
          district: selectedFarm.district,
          area_acres: areaAcres,
          practice,
          soil_moisture_pct: soilMoisture,
          salinity_dsm: salinity,
          water_level_cm: waterLevel,
          polygon: selectedFarm.polygon,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const result: HybridAnalysis = await res.json();
      setAnalysis(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Simulation failed");
    } finally {
      setAnalyzing(false);
    }
  };

  const handleSimulateIoTPush = async () => {
    if (!selectedFarm) return;
    try {
      const res = await fetch(`${API_BASE}/api/iot/ingest`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          device_id: selectedFarm.iot.device_id,
          farm_id: selectedFarm.id,
          soil_moisture_pct: soilMoisture,
          salinity_dsm: salinity,
          water_level_cm: waterLevel,
          battery_v: selectedFarm.iot.battery_v,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setIotStatus(`Telemetry synced from ${selectedFarm.iot.device_id}`);
      await handleRunSimulation();
    } catch (err) {
      setError(err instanceof Error ? err.message : "IoT ingest failed");
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      {/* Header */}
      <header className="border-b border-slate-800 bg-slate-900/70 backdrop-blur">
        <div className="mx-auto max-w-7xl px-4 py-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Sprout className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white">
                CarbonCredit — Hybrid AgriTech & dMRV Platform
              </h1>
              <p className="text-xs text-slate-400">
                1 Core Engine (Satellite + IoT) → 4 Revenue Modules (Advisory · FinTech · dMRV · Carbon FX)
              </p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 ${
                supabaseConnected
                  ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-300"
                  : "bg-slate-800 border-slate-700 text-slate-300"
              }`}
            >
              PostGIS: {supabaseConnected ? "Supabase Live" : "Local Fallback"}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-500/10 border border-sky-500/30 px-3 py-1 text-sky-300">
              <Radio className="h-3.5 w-3.5" />
              {satProvider.split("(")[0].trim()}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-950/40 px-4 py-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        {/* Top Grid: Map + Pilot Selector & Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-7 space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-400" />
                Bangladesh Pilot Clusters (GeoJSON + Sentinel-2/1)
              </h2>
              <span className="text-xs text-slate-400">Click a polygon on map</span>
            </div>

            <FarmMap
              farms={farms}
              selectedFarmId={selectedFarm?.id || ""}
              onSelectFarm={handleSelectFarm}
            />

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {farms.map((farm) => {
                const active = farm.id === selectedFarm?.id;
                return (
                  <button
                    key={farm.id}
                    onClick={() => handleSelectFarm(farm)}
                    className={`text-left rounded-xl border p-3 transition ${
                      active
                        ? "border-emerald-500 bg-emerald-500/10"
                        : "border-slate-800 bg-slate-900/60 hover:border-slate-700"
                    }`}
                  >
                    <div className="text-xs font-semibold text-emerald-400">{farm.district}</div>
                    <div className="text-sm font-medium text-white truncate">{farm.name}</div>
                    <div className="mt-1 text-xs text-slate-400">
                      {farm.area_acres} acres · {farm.farmer_count} farmers
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Simulator */}
          <div className="lg:col-span-5 rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-200 flex items-center gap-2">
                <Cpu className="h-4 w-4 text-sky-400" />
                IoT + Satellite Digital Twin Simulator
              </h2>
              {selectedFarm && (
                <span className="text-xs font-mono text-slate-400">{selectedFarm.iot.device_id}</span>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Cluster Area (Acres)</label>
                <input
                  type="number"
                  min={1}
                  max={10000}
                  value={areaAcres}
                  onChange={(e) => setAreaAcres(Number(e.target.value) || 1)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">Climate Practice</label>
                <select
                  value={practice}
                  onChange={(e) => setPractice(e.target.value as PracticeType)}
                  className="w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2 text-white"
                >
                  <option value="AWD_RICE">AWD Rice (Methane Cut)</option>
                  <option value="SALINITY_SMART">Coastal Salinity-Smart</option>
                  <option value="ORGANIC_SOIL">Organic Soil Carbon</option>
                </select>
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Soil Moisture: {soilMoisture}%
                </label>
                <input
                  type="range"
                  min={10}
                  max={90}
                  value={soilMoisture}
                  onChange={(e) => setSoilMoisture(Number(e.target.value))}
                  className="w-full accent-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-400 mb-1">
                  Salinity: {salinity} dS/m
                </label>
                <input
                  type="range"
                  min={0}
                  max={12}
                  step={0.2}
                  value={salinity}
                  onChange={(e) => setSalinity(Number(e.target.value))}
                  className="w-full accent-amber-500"
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs text-slate-400 mb-1">
                  AWD Water Level: {waterLevel} cm (relative to soil surface)
                </label>
                <input
                  type="range"
                  min={-20}
                  max={10}
                  step={0.5}
                  value={waterLevel}
                  onChange={(e) => setWaterLevel(Number(e.target.value))}
                  className="w-full accent-sky-500"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 pt-2">
              <button
                onClick={handleRunSimulation}
                disabled={analyzing || loading}
                className="flex-1 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-semibold text-sm px-4 py-2.5 transition disabled:opacity-50"
              >
                {analyzing ? "Analyzing..." : "Run Hybrid AI Analysis"}
              </button>
              <button
                onClick={handleSimulateIoTPush}
                disabled={analyzing || loading}
                className="rounded-lg border border-slate-700 hover:border-sky-500 text-slate-200 text-sm px-4 py-2.5 transition"
              >
                Push ESP32 IoT
              </button>
            </div>
            {iotStatus && <p className="text-xs text-sky-400">{iotStatus}</p>}
          </div>
        </div>

        {/* 4 Hybrid Modules Output */}
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Module 1: Farmer Advisory & AWD */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-400" />
                  1. Farmer Advisory & AWD (Day-1 Value)
                </h3>
                <span className="text-xs rounded-full bg-emerald-500/15 text-emerald-300 px-2.5 py-0.5">
                  {analysis.farmer_advisory.estimated_irrigation_savings_pct}% Water/Fuel Saved
                </span>
              </div>
              <div className="rounded-lg border border-emerald-500/20 bg-slate-950 p-3.5 text-sm text-emerald-100 leading-relaxed">
                {analysis.farmer_advisory.bangla_voice_sms}
              </div>
              <p className="text-xs text-slate-400">
                Status: <span className="font-mono text-slate-200">{analysis.farmer_advisory.status}</span> · Delivered via Bangla IVR Voice + SMS
              </p>
            </div>

            {/* Module 2: Satellite + IoT dMRV SaaS */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Satellite className="h-4 w-4 text-sky-400" />
                  2. Satellite & IoT dMRV SaaS
                </h3>
                <span className="text-xs rounded-full bg-sky-500/15 text-sky-300 px-2.5 py-0.5">
                  {analysis.satellite_dmrv.dmrv_status.split(" ")[0]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">NDVI (Crop)</div>
                  <div className="text-xl font-bold text-emerald-400">{analysis.satellite_dmrv.ndvi}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">NDWI (Water)</div>
                  <div className="text-xl font-bold text-sky-400">{analysis.satellite_dmrv.ndwi}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">NDSI (Salinity)</div>
                  <div className="text-xl font-bold text-amber-400">{analysis.satellite_dmrv.ndsi}</div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                Sources: {analysis.satellite_dmrv.data_sources.join(" · ")}
                {analysis.satellite_dmrv.cloud_cover_pct != null &&
                  ` · Cloud: ${analysis.satellite_dmrv.cloud_cover_pct}%`}
              </p>
            </div>

            {/* Module 3: Agri-FinTech & Supply Chain */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-400" />
                  3. Agri-FinTech & Scope-3 Traceability
                </h3>
                <span className="text-xs rounded-full bg-violet-500/15 text-violet-300 px-2.5 py-0.5">
                  Fast B2B Revenue
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">Farmer Credit Score</div>
                  <div className="text-2xl font-bold text-violet-300">
                    {analysis.fintech_traceability.credit_score}/100
                  </div>
                  <div className="text-xs text-slate-400">{analysis.fintech_traceability.risk_tier}</div>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">MFI / Bank Loan Limit</div>
                  <div className="text-xl font-bold text-white">
                    ৳{analysis.fintech_traceability.recommended_loan_limit_bdt.toLocaleString()}
                  </div>
                  <div className="text-xs text-emerald-400">
                    {analysis.fintech_traceability.scope3_export_ready ? "Scope-3 Traceable ✓" : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Module 4: Carbon Credit Aggregation & FX */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/60 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-400" />
                  4. Carbon Credit Aggregation & FX Export
                </h3>
                <span className="text-xs rounded-full bg-amber-500/15 text-amber-300 px-2.5 py-0.5">
                  ${analysis.carbon_aggregation.assumed_price_usd_per_ton}/tCO2e
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">CO2e Reduced/Yr</div>
                  <div className="text-lg font-bold text-emerald-400 flex items-center gap-1">
                    <Leaf className="h-4 w-4" />
                    {analysis.carbon_aggregation.estimated_tco2e_per_year} t
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">FX Export (USD)</div>
                  <div className="text-lg font-bold text-amber-300 flex items-center gap-1">
                    <Banknote className="h-4 w-4" />
                    ${analysis.carbon_aggregation.gross_export_usd.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-950 p-3 border border-slate-800">
                  <div className="text-xs text-slate-400">Startup (35%)</div>
                  <div className="text-lg font-bold text-white">
                    ৳{analysis.carbon_aggregation.startup_revenue_35_pct_bdt.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-400">
                65% Farmer Payout via bKash/Nagad:{" "}
                <span className="font-semibold text-emerald-300">
                  ৳{analysis.carbon_aggregation.farmer_payout_65_pct_bdt.toLocaleString()}/year
                </span>
              </p>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
