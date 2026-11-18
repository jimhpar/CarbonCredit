from datetime import datetime, timezone
from typing import Literal, Optional
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from services.db_service import DatabaseService
from services.satellite_service import SatelliteService

load_dotenv()

app = FastAPI(
    title="CarbonCredit — Hybrid AgriTech & dMRV API",
    description="Unified backend with Google Earth Engine / Sentinel Hub + Supabase PostGIS.",
    version="0.2.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

db = DatabaseService()
satellite = SatelliteService()


class FarmAnalyzeRequest(BaseModel):
    farm_id: Optional[str] = Field(default=None)
    name: str = Field(default="Demo Farm Plot", max_length=120)
    district: str = Field(default="Satkhira", max_length=80)
    area_acres: float = Field(default=2.5, gt=0.05, le=10000)
    practice: Literal["AWD_RICE", "SALINITY_SMART", "ORGANIC_SOIL"] = "AWD_RICE"
    soil_moisture_pct: float = Field(default=42.0, ge=0, le=100)
    salinity_dsm: float = Field(default=3.2, ge=0, le=30)
    water_level_cm: float = Field(default=-5.0, ge=-30, le=30)
    polygon: list[list[float]] = Field(
        default_factory=lambda: [
            [22.7185, 89.0705],
            [22.7198, 89.0705],
            [22.7198, 89.0722],
            [22.7185, 89.0722],
        ]
    )


class IoTTelemetry(BaseModel):
    device_id: str = Field(..., examples=["ESP32-SAT-001"])
    farm_id: str = Field(..., examples=["farm-satkhira-01"])
    soil_moisture_pct: float = Field(..., ge=0, le=100)
    salinity_dsm: float = Field(..., ge=0, le=30)
    water_level_cm: float = Field(..., ge=-30, le=30)
    battery_v: float = Field(default=3.85, ge=2.5, le=4.5)


def compute_hybrid_metrics(req: FarmAnalyzeRequest) -> dict:
    """Compute unified metrics across all 4 hybrid modules using live/fallback satellite data."""
    sat = satellite.fetch_indices(
        polygon_lat_lng=req.polygon,
        soil_moisture_pct=req.soil_moisture_pct,
        salinity_dsm=req.salinity_dsm,
        water_level_cm=req.water_level_cm,
    )
    ndvi = sat["ndvi"]
    ndwi = sat["ndwi"]
    ndsi = sat["ndsi"]

    factor_map = {
        "AWD_RICE": 1.45,
        "SALINITY_SMART": 0.95,
        "ORGANIC_SOIL": 1.15,
    }
    co2e_per_acre = factor_map[req.practice]
    total_co2e_tons = round(req.area_acres * co2e_per_acre, 2)
    usd_per_ton = 16.0
    bdt_rate = 120.0
    gross_usd = round(total_co2e_tons * usd_per_ton, 2)
    gross_bdt = round(gross_usd * bdt_rate, 0)
    farmer_share_bdt = round(gross_bdt * 0.65, 0)
    platform_share_bdt = round(gross_bdt * 0.35, 0)

    irrigation_savings_pct = 25 if req.practice == "AWD_RICE" else 15
    if req.salinity_dsm >= 4.0:
        advisory_bn = (
            f"সতর্কতা ({req.district}): মাটির লবণাক্ততা {req.salinity_dsm} dS/m। "
            "এখনই মিষ্টি পানির হালকা সেচ দিন এবং জিপসাম/জৈব সার প্রয়োগ করুন।"
        )
        risk_level = "HIGH_SALINITY"
    elif req.practice == "AWD_RICE" and req.water_level_cm <= -12.0:
        advisory_bn = (
            f"সেচ পরামর্শ ({req.district}): পানির স্তর {req.water_level_cm} সেমি নিচে নেমেছে। "
            "AWD নিয়ম অনুযায়ী এখন ৫ সেমি পর্যন্ত সেচ দিন।"
        )
        risk_level = "IRRIGATE_NOW"
    else:
        advisory_bn = (
            f"সব ঠিক আছে ({req.district}): ফসলের স্বাস্থ্য (NDVI {ndvi}) ভালো আছে। "
            "এখন সেচের প্রয়োজন নেই—ডিজেল ও পানি সাশ্রয় হচ্ছে।"
        )
        risk_level = "OPTIMAL"

    credit_score = int(
        min(96, max(45, 58 + (ndvi * 35) - (req.salinity_dsm * 2.2) + (5 if req.practice == "AWD_RICE" else 2)))
    )
    credit_tier = "A (Low Risk)" if credit_score >= 78 else "B (Moderate)" if credit_score >= 62 else "C (High Risk)"

    analysis = {
        "farm_name": req.name,
        "district": req.district,
        "area_acres": req.area_acres,
        "practice": req.practice,
        "satellite_dmrv": {
            "ndvi": ndvi,
            "ndwi": ndwi,
            "ndsi": ndsi,
            "cloud_cover_pct": sat.get("cloud_cover_pct"),
            "provider": sat["provider"],
            "data_sources": sat["data_sources"],
            "dmrv_status": "Audit-Ready (GeoJSON + Timestamped Telemetry)",
        },
        "farmer_advisory": {
            "status": risk_level,
            "bangla_voice_sms": advisory_bn,
            "estimated_irrigation_savings_pct": irrigation_savings_pct,
        },
        "fintech_traceability": {
            "credit_score": credit_score,
            "risk_tier": credit_tier,
            "recommended_loan_limit_bdt": int(req.area_acres * (18000 if credit_score >= 75 else 11000)),
            "scope3_export_ready": True,
        },
        "carbon_aggregation": {
            "estimated_tco2e_per_year": total_co2e_tons,
            "assumed_price_usd_per_ton": usd_per_ton,
            "gross_export_usd": gross_usd,
            "gross_export_bdt": gross_bdt,
            "farmer_payout_65_pct_bdt": farmer_share_bdt,
            "startup_revenue_35_pct_bdt": platform_share_bdt,
        },
    }

    db.log_satellite_and_carbon(req.farm_id, sat, analysis)
    return analysis


@app.get("/api/health")
def health():
    return {
        "status": "ok",
        "service": "CarbonCredit Hybrid Backend",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/config/status")
def config_status():
    return {
        "supabase_connected": db.connected,
        **satellite.status(),
    }


@app.get("/api/farms")
def get_pilot_farms():
    farms = db.get_farms()
    enriched = []
    for farm in farms:
        req = FarmAnalyzeRequest(
            farm_id=farm["id"],
            name=farm["name"],
            district=farm["district"],
            area_acres=farm["area_acres"],
            practice=farm["practice"],
            soil_moisture_pct=farm["iot"]["soil_moisture_pct"],
            salinity_dsm=farm["iot"]["salinity_dsm"],
            water_level_cm=farm["iot"]["water_level_cm"],
            polygon=farm["polygon"],
        )
        enriched.append({**farm, "analysis": compute_hybrid_metrics(req)})
    return {
        "farms": enriched,
        "supabase_connected": db.connected,
        "satellite_provider": satellite.status()["active_provider"],
        "telemetry_count": len(db.memory_telemetry),
    }


@app.post("/api/analyze-farm")
def analyze_farm(req: FarmAnalyzeRequest):
    return compute_hybrid_metrics(req)


@app.post("/api/iot/ingest")
def ingest_iot(payload: IoTTelemetry):
    entry = db.record_iot(payload.model_dump())
    return {"status": "ingested", "supabase_persisted": db.connected, "entry": entry}
