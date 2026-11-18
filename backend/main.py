import json
import os
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import time
from typing import Literal, Optional
import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
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


class UserCreateRequest(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=120)
    role: Literal["farmer", "field_agent", "b2b_partner", "admin"] = "farmer"
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(default="demo123", min_length=4, max_length=80)
    bkash_number: Optional[str] = None
    district: str = Field(default="Bogura", max_length=60)
    farm_id: Optional[str] = None


class SignInRequest(BaseModel):
    phone: str = Field(..., min_length=6, max_length=20)
    password: str = Field(..., min_length=4, max_length=80)


class RoleUpdateRequest(BaseModel):
    role: Literal["farmer", "field_agent", "b2b_partner", "admin"]


class FinanceCompanyCreateRequest(BaseModel):
    name: str = Field(..., min_length=2, max_length=120)
    company_type: Literal["MFI", "BANK", "AGRI_INSURER"] = "MFI"
    interest_rate_pct: float = Field(..., gt=0, le=40)
    max_loan_bdt: float = Field(..., gt=0)


class LoanApplyRequest(BaseModel):
    farm_id: str
    farmer_name: str
    phone: str
    finance_company_id: str
    finance_company_name: str
    requested_amount_bdt: float = Field(..., gt=0)
    credit_score: int = Field(..., ge=0, le=100)
    purpose: str = Field(..., min_length=3, max_length=200)


class LoanStatusRequest(BaseModel):
    status: Literal["PENDING", "APPROVED", "REJECTED"]


class NotificationTriggerRequest(BaseModel):
    farm_id: str
    channel: Literal["SMS", "IVR_VOICE", "IN_APP"] = "SMS"
    message_bn: Optional[str] = None


class PayoutCreateRequest(BaseModel):
    farm_id: str
    farmer_name: str
    bkash_number: str
    tco2e_share: float = Field(..., gt=0)
    amount_bdt: float = Field(..., gt=0)
    provider: Literal["BKASH", "NAGAD"] = "BKASH"


def compute_hybrid_metrics(
    req: FarmAnalyzeRequest, persist: bool = True, live_satellite: bool = True
) -> dict:
    """Compute unified metrics across all 4 hybrid modules using live/fallback satellite data."""
    if live_satellite:
        sat = satellite.fetch_indices(
            polygon_lat_lng=req.polygon,
            soil_moisture_pct=req.soil_moisture_pct,
            salinity_dsm=req.salinity_dsm,
            water_level_cm=req.water_level_cm,
        )
    else:
        ndvi = round(min(0.88, max(0.25, 0.45 + (req.soil_moisture_pct / 160.0) - (req.salinity_dsm * 0.025))), 2)
        ndwi = round(min(0.65, max(-0.40, (req.water_level_cm / 40.0) + (req.soil_moisture_pct - 40) / 120.0)), 2)
        ndsi = round(min(0.85, max(0.05, req.salinity_dsm / 10.0)), 2)
        sat = {
            "ndvi": ndvi,
            "ndwi": ndwi,
            "ndsi": ndsi,
            "cloud_cover_pct": None,
            "provider": "IOT_CALIBRATED_FAST",
            "data_sources": ["Sentinel-2 (Click farm for Live GEE)", "ESP32 Reference IoT"],
        }
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

    if persist:
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
        enriched.append({**farm, "analysis": compute_hybrid_metrics(req, persist=False, live_satellite=False)})

    # Sort descending by annual carbon credit potential (tCO2e/year) and assign rank 1..100
    enriched.sort(
        key=lambda f: f["analysis"]["carbon_aggregation"]["estimated_tco2e_per_year"],
        reverse=True,
    )
    for idx, farm in enumerate(enriched, start=1):
        farm["carbon_rank"] = idx

    return {
        "farms": enriched,
        "total_farms": len(enriched),
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


# --- Auth (Sign Up / Sign In) ---
@app.post("/api/auth/signup")
def signup(req: UserCreateRequest):
    user = db.create_user(req.model_dump())
    return {"status": "signed_up", "user": user}


@app.post("/api/auth/signin")
def signin(req: SignInRequest):
    user = db.signin_user(req.phone, req.password)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid phone number or password")
    return {"status": "signed_in", "user": user}


# --- User Management & Search ---
@app.get("/api/users")
def list_users(q: Optional[str] = None):
    return {"users": db.get_users(q)}


@app.post("/api/users")
def create_user(req: UserCreateRequest):
    user = db.create_user(req.model_dump())
    return {"status": "created", "user": user}


@app.patch("/api/users/{user_id}/role")
def update_user_role(user_id: str, req: RoleUpdateRequest):
    updated = db.update_user_role(user_id, req.role)
    if not updated:
        raise HTTPException(status_code=404, detail="User not found")
    return {"status": "updated", "user": updated}


# --- Finance Companies (MFI / Bank / Insurer) ---
@app.get("/api/finance-companies")
def list_finance_companies():
    return {"companies": db.get_finance_companies()}


@app.post("/api/finance-companies")
def create_finance_company(req: FinanceCompanyCreateRequest):
    company = db.create_finance_company(req.model_dump())
    return {"status": "created", "company": company}


@app.patch("/api/finance-companies/{company_id}/toggle")
def toggle_finance_company(company_id: str):
    updated = db.toggle_finance_company(company_id)
    if not updated:
        raise HTTPException(status_code=404, detail="Finance company not found")
    return {"status": "updated", "company": updated}


# --- Agri-Loan Applications ---
@app.get("/api/loans")
def list_loans(farm_id: Optional[str] = None, phone: Optional[str] = None):
    return {"loans": db.get_loans(farm_id=farm_id, phone=phone)}


@app.post("/api/loans/apply")
def apply_loan(req: LoanApplyRequest):
    loan = db.apply_loan(req.model_dump())
    return {"status": "submitted", "loan": loan}


@app.patch("/api/loans/{loan_id}/status")
def update_loan_status(loan_id: str, req: LoanStatusRequest):
    updated = db.update_loan_status(loan_id, req.status)
    if not updated:
        raise HTTPException(status_code=404, detail="Loan application not found")
    return {"status": "updated", "loan": updated}


# --- Notifications ---
@app.get("/api/notifications")
def list_notifications(farm_id: Optional[str] = None):
    return {"notifications": db.get_notifications(farm_id)}


@app.post("/api/notifications/trigger")
def trigger_notification(req: NotificationTriggerRequest):
    msg = req.message_bn
    if not msg:
        farms = db.get_farms()
        target = next((f for f in farms if f["id"] == req.farm_id), None)
        district = target["district"] if target else "Bangladesh"
        msg = (
            f"অটো অ্যালার্ট ({district}): আপনার জমির IoT ও স্যাটেলাইট ডেটা আপডেট হয়েছে। "
            "সঠিক সময়ে AWD সেচ দিন এবং কার্বন ক্রেডিট বোনাস অর্জন করুন।"
        )
    entry = db.add_notification(req.farm_id, req.channel, msg)
    return {"status": "sent", "notification": entry}


# --- Payouts & Revenue Ledger ---
@app.get("/api/payouts")
def list_payouts(farm_id: Optional[str] = None):
    payouts = db.get_payouts(farm_id)
    total_paid = sum(p["amount_bdt"] for p in payouts if p["status"] == "PAID")
    total_pending = sum(p["amount_bdt"] for p in payouts if p["status"] == "PENDING")
    return {
        "payouts": payouts,
        "summary": {
            "total_paid_bdt": round(total_paid, 0),
            "total_pending_bdt": round(total_pending, 0),
        },
    }


@app.post("/api/payouts/generate")
def generate_payout(req: PayoutCreateRequest):
    payout = db.create_payout(req.model_dump())
    return {"status": "created", "payout": payout}


@app.patch("/api/payouts/{payout_id}/approve")
def approve_payout(payout_id: str):
    updated = db.approve_payout(payout_id)
    return {"status": "approved" if updated else "not_found", "payout": updated}


# --- Time-Series Statistics ---
@app.get("/api/stats/{farm_id}")
def farm_statistics(farm_id: str, ndvi: float = 0.62, water_cm: float = -6.0):
    series = db.get_farm_timeseries(farm_id, base_ndvi=ndvi, base_water=water_cm)
    return {"farm_id": farm_id, "series": series}


_WEATHER_CACHE: dict[str, tuple[float, dict]] = {}


@app.get("/api/weather")
def get_weather(lat: float = 23.8103, lng: float = 89.4173):
    key = f"{round(lat, 2)},{round(lng, 2)}"
    cached = _WEATHER_CACHE.get(key)
    if cached and (time.time() - cached[0]) < 300:
        return cached[1]

    try:
        url = (
            "https://api.open-meteo.com/v1/forecast"
            f"?latitude={lat}&longitude={lng}"
            "&current=temperature_2m,relative_humidity_2m,cloud_cover,wind_speed_10m,wind_direction_10m,precipitation,weather_code"
        )
        with httpx.Client(timeout=8.0) as client:
            res = client.get(url)
            res.raise_for_status()
            cur = res.json().get("current", {})

        payload = {
            "source": "Open-Meteo Live",
            "temperature_c": cur.get("temperature_2m", 28.0),
            "humidity_pct": cur.get("relative_humidity_2m", 72),
            "cloud_cover_pct": cur.get("cloud_cover", 15),
            "wind_speed_kmh": cur.get("wind_speed_10m", 11.5),
            "wind_direction_deg": cur.get("wind_direction_10m", 140),
            "precipitation_mm": cur.get("precipitation", 0.0),
        }
        _WEATHER_CACHE[key] = (time.time(), payload)
        return payload
    except Exception:
        return {
            "source": "Fallback",
            "temperature_c": 29.5,
            "humidity_pct": 70,
            "cloud_cover_pct": 12,
            "wind_speed_kmh": 10.2,
            "wind_direction_deg": 135,
            "precipitation_mm": 0.0,
        }


_CLOUD_GRID_CACHE: tuple[float, list[dict]] | None = None


@app.get("/api/weather/cloud-grid")
def get_cloud_grid():
    """Fetch live Open-Meteo cloud cover across 8 Bangladesh regions in a single batch call."""
    global _CLOUD_GRID_CACHE
    if _CLOUD_GRID_CACHE and (time.time() - _CLOUD_GRID_CACHE[0]) < 300:
        return {"regions": _CLOUD_GRID_CACHE[1]}

    regions = [
        ("Bogura", 24.67, 89.42),
        ("Rajshahi", 24.47, 88.33),
        ("Dinajpur", 25.85, 88.65),
        ("Sylhet", 25.08, 91.76),
        ("Dhaka", 23.81, 90.41),
        ("Comilla", 23.54, 90.72),
        ("Satkhira", 22.33, 89.10),
        ("Patuakhali", 21.99, 90.24),
    ]
    lats = ",".join(str(r[1]) for r in regions)
    lngs = ",".join(str(r[2]) for r in regions)

    try:
        url = f"https://api.open-meteo.com/v1/forecast?latitude={lats}&longitude={lngs}&current=cloud_cover"
        with httpx.Client(timeout=8.0) as client:
            res = client.get(url)
            res.raise_for_status()
            data = res.json()

        results = []
        items = data if isinstance(data, list) else [data]
        for idx, (name, lat, lng) in enumerate(regions):
            cc = items[idx].get("current", {}).get("cloud_cover", 30) if idx < len(items) else 30
            results.append({"name": name, "lat": lat, "lng": lng, "cloud_cover_pct": cc})

        _CLOUD_GRID_CACHE = (time.time(), results)
        return {"regions": results}
    except Exception:
        fallback = [
            {"name": name, "lat": lat, "lng": lng, "cloud_cover_pct": 35}
            for name, lat, lng in regions
        ]
        return {"regions": fallback}


_BD_BORDER_CACHE: dict | None = None


@app.get("/api/geo/bangladesh-border")
def get_bangladesh_border():
    """Return exact Bangladesh GeoJSON boundary from local FAO/GAUL dataset."""
    global _BD_BORDER_CACHE
    if _BD_BORDER_CACHE is not None:
        return _BD_BORDER_CACHE

    local_path = os.path.join(os.path.dirname(__file__), "data", "bangladesh_border.geojson")
    if os.path.exists(local_path):
        with open(local_path, encoding="utf-8") as f:
            _BD_BORDER_CACHE = json.load(f)
            return _BD_BORDER_CACHE

    return {"type": "FeatureCollection", "features": []}
