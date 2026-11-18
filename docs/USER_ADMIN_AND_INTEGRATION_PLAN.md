# CarbonCredit — User vs. Admin Architecture & Integration Plan

## 1. Role-Based User Management (Supabase Auth + RBAC + RLS)

Use **Supabase Auth** (Phone OTP for farmers, Email/Password for Admins & B2B Partners) with a `profiles` table and **Row-Level Security (RLS)**:

| Role | Who Uses It | Access Scope |
|---|---|---|
| `farmer` | Individual farmer / cluster lead | Sees only their own plots, Bangla alerts, water/fuel savings, and bKash/Nagad carbon payout history. |
| `field_agent` | Union-level agro-tech agent | Can onboard farmers, draw/verify GeoJSON farm polygons, and install/pair ESP32 IoT devices. |
| `b2b_partner` | MFI / Bank / Carbon Developer | Read-only access to Credit Scores, Scope-3 reports, and dMRV audit exports for assigned clusters. |
| `admin` | CarbonCredit core team | Full access: all clusters, IoT fleet health, GEE sync jobs, revenue ledger, payout approvals, and user management. |

### Database Additions Needed
- `profiles` (`id uuid PK`, `role`, `full_name`, `phone`, `nid_last4`, `bkash_number`, `district`, `upazila`)
- `farm_members` (`farm_id`, `user_id`, `plot_acres`, `share_pct`) — links individual farmers to a union cluster.
- `notifications` (`id`, `user_id`, `farm_id`, `channel`: `SMS | IVR_VOICE | IN_APP`, `message_bn`, `status`, `sent_at`)
- `payouts` (`id`, `farm_id`, `user_id`, `amount_bdt`, `provider`: `BKASH | NAGAD`, `tx_ref`, `status`: `PENDING | PAID`)

---

## 2. User-End vs. Admin-End Dashboard Differences

### A. User-End Dashboard (`/farmer` — Mobile-First, Bangla-First)
Designed for simplicity on low-end smartphones:
1. **My Plot Status Card:** Green/Yellow/Red indicator (e.g., *"জমিতে পানি ঠিক আছে — আজ সেচ লাগবে না"*).
2. **Today's Bangla Action & Voice Play:** One-tap audio playback of the Bangla advisory + water/diesel saved this season (in ৳).
3. **My Carbon & Payout Wallet:** Shows total $\text{tCO}_2\text{e}$ earned by their plot, pending ৳ balance, and **bKash/Nagad payout history**.
4. **Simple Issue Report:** One button to report sensor damage or pest issues to their local Field Agent.

### B. Admin-End Dashboard (`/admin` — Full GIS Command Center)
Designed for operations, dMRV auditing, and B2B/grant reporting:
1. **National GIS Map & Cluster Heatmap:** All districts, polygon boundaries, NDVI/NDWI/NDSI overlays, and filter by practice (`AWD_RICE`, `SALINITY_SMART`, `ORGANIC_SOIL`).
2. **IoT Fleet & GEE Sync Monitor:** Device online/offline status, battery voltage (`battery_v < 3.4V` alert), last telemetry timestamp, and scheduled GEE batch fetch logs.
3. **User & Onboarding Management:** Approve Field Agents, verify farmer NID/bKash numbers, and merge small plots into 10,000+ acre carbon pools.
4. **Revenue & Payout Control:** Approve 65% farmer payouts (bulk bKash/Nagad disbursement), track 35% platform share, MFI API usage billing, and dMRV SaaS invoices.
5. **Audit & Export Center:** Export Verra/Gold Standard-ready GeoJSON + timestamped IoT + Sentinel-2 CSV/JSON bundles.

---

## 3. Data Tracking Pipeline (Automated)

1. **Spatial Tracking:** Field Agent walks plot boundary on mobile → Leaflet/GPS saves GeoJSON polygon → PostGIS `ST_Area(geom::geography)` auto-computes exact acres.
2. **IoT Tracking:** ESP32 wakes every 1–6 hours → `POST /api/iot/ingest` (authenticated via device API key) → inserts into `iot_telemetry`.
3. **Satellite Tracking:** Scheduled cron job (every 5 days matching Sentinel-2 revisit) queries GEE for all active `farms` → stores historical time-series in `satellite_observations`.
4. **Carbon & FinTech Ledger:** Monthly aggregation job computes seasonal $\text{tCO}_2\text{e}$ & updates `carbon_ledger` + `fintech_traceability` scores.

---

## 4. Notification Integration Plan

- **Trigger Engine (FastAPI Background Worker / Cron):**
  - `salinity_dsm >= 4.0` → Immediate **High Salinity Alert**.
  - `water_level_cm <= -12.0` (AWD Rice) → **Irrigate Now Alert**.
  - `battery_v < 3.4` or no telemetry for 48h → **Admin Device Maintenance Alert**.
- **Delivery Channels (Bangladesh):**
  - **SMS:** SSL Wireless / BulkSMSBD / Twilio REST API for Bangla Unicode SMS.
  - **Voice IVR (for low-literacy farmers):** Bangla TTS (e.g., Google Cloud TTS `bn-BD` or pre-recorded audio clips) delivered via local telco IVR / Twilio Voice.
  - **In-App / Web:** Real-time updates via Supabase Realtime subscriptions.

---

## 5. Revenue & Statistics Integration

### Revenue Streams & Ledger
1. **Local B2B (Month 3–6):** MFI/Bank Credit-Score API (per-query or monthly SaaS) + Agro-input dealer targeted advisory sponsorship.
2. **dMRV SaaS (Month 6–12):** Subscription fee from NGOs / carbon developers using the audit export dashboard.
3. **Carbon FX & Payouts (Month 12–24+):** USD inflow → split 65% to `payouts` queue (disbursed via **bKash Disbursement API / Nagad API**) and 35% platform revenue.

### Statistics & Analytics (Dashboard Charts)
- **Time-Series Charts:** 30/90-day NDVI, AWD water-level cycles, and soil salinity trends per cluster.
- **Impact KPIs:** Total acres covered, total farmers onboarded, liters of irrigation water saved, total $\text{tCO}_2\text{e}$ verified, and total BDT disbursed.
