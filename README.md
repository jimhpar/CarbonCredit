# CarbonCredit — Hybrid AgriTech & dMRV Platform

Unified MVP combining **Farmer Advisory (AWD & Salinity)**, **Satellite + IoT dMRV**, **Agri-FinTech Credit Scoring**, and **Carbon Credit Aggregation** for Bangladesh.

## Quick Start

### 1. Start Python FastAPI Backend
```powershell
cd backend
.\.venv\Scripts\uvicorn main:app --reload --port 8000
```
API docs available at `http://localhost:8000/docs`.

### 2. Start Next.js Frontend
```powershell
cd frontend
npm run dev
```
Open `http://localhost:3000`.

## Project Structure
- `backend/` — FastAPI hybrid engine (`/api/farms`, `/api/analyze-farm`, `/api/iot/ingest`)
- `frontend/` — Next.js + TypeScript + Tailwind + Leaflet GIS dashboard
- `docs/HYBRID_ARCHITECTURE_AND_GRANT_ROADMAP.md` — Tech stack rationale & ICT Grant 2026 roadmap
