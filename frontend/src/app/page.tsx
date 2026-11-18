"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import {
  Activity,
  Banknote,
  Cloud,
  Cpu,
  Droplets,
  Globe,
  Leaf,
  MapPin,
  Satellite,
  Search,
  ShieldCheck,
  Thermometer,
  Trophy,
  Wind,
} from "lucide-react";
import Navbar from "@/components/Navbar";
import TrendChart from "@/components/TrendChart";
import type { HybridAnalysis, PilotFarm, PracticeType, TimeSeriesPoint } from "@/types/agrotwin";

const FarmMap = dynamic(() => import("@/components/FarmMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[520px] w-full rounded-xl border border-slate-200 bg-white flex items-center justify-center text-slate-500 text-sm">
      Loading Bangladesh GIS Map...
    </div>
  ),
});

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

interface WeatherInfo {
  source: string;
  temperature_c: number;
  humidity_pct: number;
  cloud_cover_pct: number;
  wind_speed_kmh: number;
  wind_direction_deg: number;
  precipitation_mm: number;
}

function degToCompass(deg: number): string {
  const dirs = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return dirs[Math.round(deg / 45) % 8];
}

export default function Home() {
  const [farms, setFarms] = useState<PilotFarm[]>([]);
  const [selectedFarm, setSelectedFarm] = useState<PilotFarm | null>(null);
  const [analysis, setAnalysis] = useState<HybridAnalysis | null>(null);
  const [series, setSeries] = useState<TimeSeriesPoint[]>([]);
  const [weather, setWeather] = useState<WeatherInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [iotStatus, setIotStatus] = useState<string | null>(null);
  const [supabaseConnected, setSupabaseConnected] = useState<boolean>(false);
  const [satProvider, setSatProvider] = useState<string>("Checking...");
  const [farmSearch, setFarmSearch] = useState<string>("");

  const [areaAcres, setAreaAcres] = useState<number>(65);
  const [practice, setPractice] = useState<PracticeType>("AWD_RICE");
  const [soilMoisture, setSoilMoisture] = useState<number>(54);
  const [salinity, setSalinity] = useState<number>(0.6);
  const [waterLevel, setWaterLevel] = useState<number>(-7.5);

  const loadStats = useCallback(async (farmId: string, ndvi: number, waterCm: number, center?: [number, number]) => {
    try {
      const [sRes, wRes] = await Promise.all([
        fetch(`${API_BASE}/api/stats/${farmId}?ndvi=${ndvi}&water_cm=${waterCm}`),
        center
          ? fetch(`${API_BASE}/api/weather?lat=${center[0]}&lng=${center[1]}`)
          : Promise.resolve(null),
      ]);
      if (sRes.ok) {
        const data = await sRes.json();
        setSeries(data.series || []);
      }
      if (wRes && wRes.ok) {
        setWeather(await wRes.json());
      }
    } catch {
      // ignore stats/weather error
    }
  }, []);

  const loadFarms = useCallback(async () => {
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
        loadStats(first.id, first.analysis.satellite_dmrv.ndvi, first.iot.water_level_cm, first.center);
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
  }, [loadStats]);

  useEffect(() => {
    loadFarms();
  }, [loadFarms]);

  const handleSelectFarm = async (farm: PilotFarm) => {
    setSelectedFarm(farm);
    setAnalysis(farm.analysis);
    setAreaAcres(farm.area_acres);
    setPractice(farm.practice);
    setSoilMoisture(farm.iot.soil_moisture_pct);
    setSalinity(farm.iot.salinity_dsm);
    setWaterLevel(farm.iot.water_level_cm);
    setIotStatus(null);
    loadStats(farm.id, farm.analysis.satellite_dmrv.ndvi, farm.iot.water_level_cm, farm.center);

    // Fetch live GEE satellite indices for the selected farm
    try {
      const res = await fetch(`${API_BASE}/api/analyze-farm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          farm_id: farm.id,
          name: farm.name,
          district: farm.district,
          area_acres: farm.area_acres,
          practice: farm.practice,
          soil_moisture_pct: farm.iot.soil_moisture_pct,
          salinity_dsm: farm.iot.salinity_dsm,
          water_level_cm: farm.iot.water_level_cm,
          polygon: farm.polygon,
        }),
      });
      if (res.ok) {
        const liveResult: HybridAnalysis = await res.json();
        setAnalysis(liveResult);
      }
    } catch {
      // keep fast local metrics if live call fails
    }
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
      loadStats(selectedFarm.id, result.satellite_dmrv.ndvi, waterLevel);
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
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <Navbar supabaseConnected={supabaseConnected} satProvider={satProvider} />

      <main className="mx-auto max-w-7xl px-4 py-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
            {error}
          </div>
        )}

        {/* Top Grid: Map + Pilot Selector & Simulator */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
          <div className="lg:col-span-7 flex flex-col gap-3">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-700 flex items-center gap-2">
                <MapPin className="h-4 w-4 text-emerald-600" />
                Bangladesh Pilot Clusters (GeoJSON + Sentinel-2/1)
              </h2>
              <span className="text-xs text-slate-500">Click a polygon on map</span>
            </div>

            <div className="flex-1 min-h-[540px]">
              <FarmMap
                farms={farms}
                selectedFarmId={selectedFarm?.id || ""}
                onSelectFarm={handleSelectFarm}
                cloudCoverPct={weather?.cloud_cover_pct}
                heightClass="h-full min-h-[540px]"
              />
            </div>

            {weather && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex items-center gap-2.5">
                  <Thermometer className="h-4 w-4 text-rose-500 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500">Temperature</div>
                    <div className="text-sm font-bold text-slate-900">{weather.temperature_c}°C</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex items-center gap-2.5">
                  <Wind className="h-4 w-4 text-sky-600 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500">Wind</div>
                    <div className="text-sm font-bold text-slate-900">
                      {weather.wind_speed_kmh} km/h {degToCompass(weather.wind_direction_deg)}
                    </div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex items-center gap-2.5">
                  <Cloud className="h-4 w-4 text-slate-500 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500">Cloud Cover</div>
                    <div className="text-sm font-bold text-slate-900">{weather.cloud_cover_pct}%</div>
                  </div>
                </div>
                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2.5 shadow-sm flex items-center gap-2.5">
                  <Droplets className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div>
                    <div className="text-[11px] text-slate-500">Humidity / Rain</div>
                    <div className="text-sm font-bold text-slate-900">
                      {weather.humidity_pct}% · {weather.precipitation_mm}mm
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Right Column: Simulator + Top 3 Cards + Ranked Directory */}
          <div className="lg:col-span-5 space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-800 flex items-center gap-2">
                  <Cpu className="h-4 w-4 text-sky-600" />
                  IoT + Satellite Digital Twin Simulator
                </h2>
                {selectedFarm && (
                  <span className="text-xs font-mono text-slate-500">{selectedFarm.iot.device_id}</span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Cluster Area (Acres)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    value={areaAcres}
                    onChange={(e) => setAreaAcres(Number(e.target.value) || 1)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Climate Practice
                  </label>
                  <select
                    value={practice}
                    onChange={(e) => setPractice(e.target.value as PracticeType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900"
                  >
                    <option value="AWD_RICE">AWD Rice (Methane Cut)</option>
                    <option value="SALINITY_SMART">Coastal Salinity-Smart</option>
                    <option value="ORGANIC_SOIL">Organic Soil Carbon</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    Soil Moisture: {soilMoisture}%
                  </label>
                  <input
                    type="range"
                    min={10}
                    max={90}
                    value={soilMoisture}
                    onChange={(e) => setSoilMoisture(Number(e.target.value))}
                    className="w-full accent-emerald-600"
                  />
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">
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
                  <label className="block text-xs font-medium text-slate-600 mb-1">
                    AWD Water Level: {waterLevel} cm (relative to soil surface)
                  </label>
                  <input
                    type="range"
                    min={-20}
                    max={10}
                    step={0.5}
                    value={waterLevel}
                    onChange={(e) => setWaterLevel(Number(e.target.value))}
                    className="w-full accent-sky-600"
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-1">
                <button
                  onClick={handleRunSimulation}
                  disabled={analyzing || loading}
                  className="flex-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm px-4 py-2.5 transition disabled:opacity-50"
                >
                  {analyzing ? "Analyzing..." : "Run Hybrid AI Analysis"}
                </button>
                <button
                  onClick={handleSimulateIoTPush}
                  disabled={analyzing || loading}
                  className="rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-medium text-sm px-4 py-2.5 transition"
                >
                  Push ESP32 IoT
                </button>
              </div>
              {iotStatus && <p className="text-xs font-medium text-sky-700">{iotStatus}</p>}
            </div>

            {/* Top 3 Carbon Credit Ranked Farms */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                  <Trophy className="h-3.5 w-3.5 text-amber-500" />
                  Top 3 Carbon Credit Clusters ({farms.length} Total)
                </h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {farms.slice(0, 3).map((farm, idx) => {
                  const active = farm.id === selectedFarm?.id;
                  const rank = farm.carbon_rank ?? idx + 1;
                  return (
                    <button
                      key={farm.id}
                      onClick={() => handleSelectFarm(farm)}
                      className={`text-left rounded-xl border p-2.5 transition shadow-sm ${
                        active
                          ? "border-emerald-500 bg-emerald-50"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[11px] font-semibold text-emerald-700">{farm.district}</span>
                        <span className="rounded-full bg-amber-100 text-amber-800 px-1.5 py-0.5 text-[10px] font-bold">
                          #{rank}
                        </span>
                      </div>
                      <div className="text-xs font-semibold text-slate-900 truncate mt-1">{farm.name}</div>
                      <div className="mt-0.5 text-[11px] font-semibold text-emerald-700">
                        {farm.analysis.carbon_aggregation.estimated_tco2e_per_year} tCO2e
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Searchable Ranked Directory (#4 - #100) */}
            <div className="rounded-xl border border-slate-200 bg-white p-3.5 shadow-sm space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">
                  Ranked Directory (#4 – #{farms.length})
                </span>
                <div className="relative">
                  <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1.5" />
                  <input
                    type="text"
                    value={farmSearch}
                    onChange={(e) => setFarmSearch(e.target.value)}
                    placeholder="Search 100 farms..."
                    className="w-40 sm:w-44 rounded-lg border border-slate-300 pl-8 pr-2.5 py-1 text-xs"
                  />
                </div>
              </div>

              <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                {(farmSearch.trim()
                  ? farms.filter(
                      (f) =>
                        f.name.toLowerCase().includes(farmSearch.toLowerCase()) ||
                        f.district.toLowerCase().includes(farmSearch.toLowerCase()) ||
                        f.practice.toLowerCase().includes(farmSearch.toLowerCase())
                    )
                  : farms.slice(3)
                ).map((farm) => {
                  const active = farm.id === selectedFarm?.id;
                  return (
                    <button
                      key={farm.id}
                      onClick={() => handleSelectFarm(farm)}
                      className={`w-full text-left py-1.5 px-2 flex items-center justify-between gap-2 text-xs transition rounded-lg ${
                        active ? "bg-emerald-50 text-emerald-900" : "hover:bg-slate-50"
                      }`}
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="font-mono font-bold text-slate-500 w-7 shrink-0">
                          #{farm.carbon_rank}
                        </span>
                        <div className="truncate">
                          <span className="font-semibold text-slate-900">{farm.name}</span>
                          <span className="text-slate-500 ml-1">({farm.district})</span>
                        </div>
                      </div>
                      <span className="shrink-0 font-semibold text-emerald-700">
                        {farm.analysis.carbon_aggregation.estimated_tco2e_per_year}t
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>

        {/* 4 Hybrid Modules Output */}
        {analysis && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {/* Module 1: Farmer Advisory & AWD */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Activity className="h-4 w-4 text-emerald-600" />
                  1. Farmer Advisory & AWD (Day-1 Value)
                </h3>
                <span className="text-xs font-medium rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 px-2.5 py-0.5">
                  {analysis.farmer_advisory.estimated_irrigation_savings_pct}% Water/Fuel Saved
                </span>
              </div>
              <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-3.5 text-sm text-emerald-950 leading-relaxed">
                {analysis.farmer_advisory.bangla_voice_sms}
              </div>
              <p className="text-xs text-slate-500">
                Status: <span className="font-mono text-slate-800">{analysis.farmer_advisory.status}</span> · Delivered via Bangla IVR Voice + SMS
              </p>
            </div>

            {/* Module 2: Satellite + IoT dMRV SaaS */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Satellite className="h-4 w-4 text-sky-600" />
                  2. Satellite & IoT dMRV SaaS
                </h3>
                <span className="text-xs font-medium rounded-full bg-sky-50 border border-sky-200 text-sky-700 px-2.5 py-0.5">
                  {analysis.satellite_dmrv.dmrv_status.split(" ")[0]}
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-center">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">NDVI (Crop)</div>
                  <div className="text-xl font-bold text-emerald-600">{analysis.satellite_dmrv.ndvi}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">NDWI (Water)</div>
                  <div className="text-xl font-bold text-sky-600">{analysis.satellite_dmrv.ndwi}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">NDSI (Salinity)</div>
                  <div className="text-xl font-bold text-amber-600">{analysis.satellite_dmrv.ndsi}</div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                Sources: {analysis.satellite_dmrv.data_sources.join(" · ")}
                {analysis.satellite_dmrv.cloud_cover_pct != null &&
                  ` · Cloud: ${analysis.satellite_dmrv.cloud_cover_pct}%`}
              </p>
            </div>

            {/* Module 3: Agri-FinTech & Supply Chain */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  3. Agri-FinTech & Scope-3 Traceability
                </h3>
                <span className="text-xs font-medium rounded-full bg-violet-50 border border-violet-200 text-violet-700 px-2.5 py-0.5">
                  Fast B2B Revenue
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">Farmer Credit Score</div>
                  <div className="text-2xl font-bold text-violet-700">
                    {analysis.fintech_traceability.credit_score}/100
                  </div>
                  <div className="text-xs text-slate-500">{analysis.fintech_traceability.risk_tier}</div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">MFI / Bank Loan Limit</div>
                  <div className="text-xl font-bold text-slate-900">
                    ৳{analysis.fintech_traceability.recommended_loan_limit_bdt.toLocaleString()}
                  </div>
                  <div className="text-xs font-medium text-emerald-700">
                    {analysis.fintech_traceability.scope3_export_ready ? "Scope-3 Traceable ✓" : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Module 4: Carbon Credit Aggregation & FX */}
            <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-slate-900 flex items-center gap-2">
                  <Globe className="h-4 w-4 text-amber-600" />
                  4. Carbon Credit Aggregation & FX Export
                </h3>
                <span className="text-xs font-medium rounded-full bg-amber-50 border border-amber-200 text-amber-700 px-2.5 py-0.5">
                  ${analysis.carbon_aggregation.assumed_price_usd_per_ton}/tCO2e
                </span>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">CO2e Reduced/Yr</div>
                  <div className="text-lg font-bold text-emerald-600 flex items-center gap-1">
                    <Leaf className="h-4 w-4" />
                    {analysis.carbon_aggregation.estimated_tco2e_per_year} t
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">FX Export (USD)</div>
                  <div className="text-lg font-bold text-amber-600 flex items-center gap-1">
                    <Banknote className="h-4 w-4" />
                    ${analysis.carbon_aggregation.gross_export_usd.toLocaleString()}
                  </div>
                </div>
                <div className="rounded-lg bg-slate-50 p-3 border border-slate-200">
                  <div className="text-xs text-slate-500">Startup (35%)</div>
                  <div className="text-lg font-bold text-slate-900">
                    ৳{analysis.carbon_aggregation.startup_revenue_35_pct_bdt.toLocaleString()}
                  </div>
                </div>
              </div>
              <p className="text-xs text-slate-500">
                65% Farmer Payout via bKash/Nagad:{" "}
                <span className="font-semibold text-emerald-700">
                  ৳{analysis.carbon_aggregation.farmer_payout_65_pct_bdt.toLocaleString()}/year
                </span>
              </p>
            </div>
          </div>
        )}

        {/* Step 2: 30-Day Time-Series Statistics */}
        {selectedFarm && <TrendChart data={series} farmName={selectedFarm.name} />}
      </main>
    </div>
  );
}
