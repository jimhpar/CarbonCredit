# CarbonCredit — Hybrid AgriTech & dMRV Platform

## 1. Recommended Tech Stack (Best Fit for This Hybrid System)

| Layer | Technology | Why This Stack? |
|---|---|---|
| **Frontend & GIS Dashboard** | **Next.js (TypeScript) + Tailwind CSS + Leaflet** | Fast interactive maps (GeoJSON farm polygons), clean SaaS/FinTech dashboards, instant Vercel deployment for grant demos. |
| **Backend & Geospatial/AI Engine** | **Python (FastAPI)** | Python is the industry standard for satellite imagery (`earthengine-api`, `rasterio`, `numpy`), ML yield/credit scoring, and IPCC/Verra carbon math. FastAPI provides high-speed async REST APIs + auto Swagger docs (`/docs`). |
| **Database (Production)** | **PostgreSQL + PostGIS (via Supabase)** | PostGIS natively stores farm polygons & runs spatial queries; Supabase adds auth + real-time IoT streams on a free tier. |
| **Satellite Data (Free Tier)** | **Sentinel-2 (ESA) + Sentinel-1 SAR + Google Earth Engine** | Sentinel-2 gives 10m optical NDVI/NDWI/NDSI every 5 days; Sentinel-1 SAR penetrates monsoon clouds to verify AWD rice irrigation. |
| **IoT Reference Nodes (Phase 2)** | **ESP32 + GSM/LoRa + Soil/Water Sensors** | ~2,500–4,500 BDT per node; 2–3 reference nodes per union calibrate satellite data for hundreds of surrounding farms. |

---

## 2. Unified Hybrid Architecture (1 Core Engine → 4 Modules)

All 4 business possibilities share **one core data pipeline** (Farm GeoJSON + Satellite Indices + Reference IoT):

1. **Module 1 — Farmer Advisory & AWD (Day 1 Adoption):**
   - Sends Bangla Voice/SMS alerts for irrigation timing (AWD) and coastal salinity protection.
   - Cuts diesel/electricity irrigation costs by 20–30% immediately.
2. **Module 2 — Agri-FinTech & Supply-Chain Traceability (Fastest Revenue, Month 3–6):**
   - Converts satellite crop health + yield stability into a **Farmer Credit/Risk Score (0–100)** for Banks, MFIs, and Crop Insurers.
   - Generates Scope-3 sustainability reports for export buyers.
3. **Module 3 — dMRV SaaS (Medium Term, Month 6–12):**
   - Provides audit-ready Digital MRV (Measurement, Reporting, Verification) dashboards and APIs to NGOs and international carbon project developers (who bear the Verra/Gold Standard audit fees).
4. **Module 4 — Carbon Credit Aggregation & FX Export (Long Term, Month 12–24+):**
   - Aggregates 10,000+ acres across unions, certifies under Verra (VM0051 for AWD rice) or Gold Standard, sells credits in USD, and distributes 65% to farmers via bKash/Nagad.

---

## 3. ICT Startup Grant 2026 Alignment

- **Stage 1 (1–3 Lakh BDT — Idea):** Company/trade license registration, satellite+calculator web prototype, initial farmer survey.
- **Stage 2 (3–10 Lakh BDT — MVP):** 5–10 weatherproof ESP32 reference sensors deployed in 1–2 pilot upazilas (e.g., Bogura for AWD rice, Satkhira for coastal salinity) + 50–100 farmer Bangla alert pilot.
- **Stage 3 (10–30 Lakh BDT — Seed/Pre-Seed):** B2B FinTech credit-scoring API with MFIs/agro-input partners; scale to 1,000+ farmers.
- **Stage 4 (30–50 Lakh BDT — Special Innovation):** Full automated dMRV + Carbon Credit Aggregation & FX export pipeline.
