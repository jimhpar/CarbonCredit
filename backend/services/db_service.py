import hashlib
import os
import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from services.farm_catalog import generate_100_farms

DEFAULT_PILOT_FARMS = [
    {
        "id": "farm-bogura-01",
        "name": "Sherpur Boro AWD Cluster",
        "district": "Bogura",
        "farmer_count": 48,
        "area_acres": 65.0,
        "practice": "AWD_RICE",
        "center": [24.6712, 89.4173],
        "polygon": [
            [24.6700, 89.4155],
            [24.6725, 89.4155],
            [24.6725, 89.4192],
            [24.6700, 89.4192],
        ],
        "iot": {
            "device_id": "ESP32-BOG-01",
            "soil_moisture_pct": 54.0,
            "salinity_dsm": 0.6,
            "water_level_cm": -7.5,
            "battery_v": 4.02,
        },
    },
    {
        "id": "farm-satkhira-01",
        "name": "Shyamnagar Coastal Salinity Block",
        "district": "Satkhira",
        "farmer_count": 35,
        "area_acres": 42.0,
        "practice": "SALINITY_SMART",
        "center": [22.3306, 89.1028],
        "polygon": [
            [22.3292, 89.1010],
            [22.3320, 89.1010],
            [22.3320, 89.1046],
            [22.3292, 89.1046],
        ],
        "iot": {
            "device_id": "ESP32-SAT-04",
            "soil_moisture_pct": 38.5,
            "salinity_dsm": 4.8,
            "water_level_cm": 1.5,
            "battery_v": 3.79,
        },
    },
    {
        "id": "farm-rajshahi-01",
        "name": "Godagari Drought-Resilient Plot",
        "district": "Rajshahi",
        "farmer_count": 28,
        "area_acres": 36.0,
        "practice": "ORGANIC_SOIL",
        "center": [24.4667, 88.3306],
        "polygon": [
            [24.4654, 88.3290],
            [24.4680, 88.3290],
            [24.4680, 88.3322],
            [24.4654, 88.3322],
        ],
        "iot": {
            "device_id": "ESP32-RAJ-02",
            "soil_moisture_pct": 29.0,
            "salinity_dsm": 0.9,
            "water_level_cm": -12.0,
            "battery_v": 3.91,
        },
    },
]

DEFAULT_USERS = [
    {
        "id": "usr-admin-01",
        "full_name": "Zim (Platform Admin)",
        "role": "admin",
        "phone": "01700000001",
        "bkash_number": None,
        "district": "Dhaka",
        "farm_id": None,
    },
    {
        "id": "usr-agent-01",
        "full_name": "Rafiqul Islam (Field Agent)",
        "role": "field_agent",
        "phone": "01711000002",
        "bkash_number": "01711000002",
        "district": "Bogura",
        "farm_id": "farm-bogura-01",
    },
    {
        "id": "usr-farmer-01",
        "full_name": "Abdul Karim (Farmer)",
        "role": "farmer",
        "phone": "01812000003",
        "bkash_number": "01812000003",
        "district": "Bogura",
        "farm_id": "farm-bogura-01",
    },
    {
        "id": "usr-farmer-02",
        "full_name": "Mizanur Rahman (Farmer)",
        "role": "farmer",
        "phone": "01913000004",
        "bkash_number": "01913000004",
        "district": "Satkhira",
        "farm_id": "farm-satkhira-01",
    },
    {
        "id": "usr-b2b-01",
        "full_name": "GreenBank MFI Partner",
        "role": "b2b_partner",
        "phone": "01755000005",
        "bkash_number": None,
        "district": "Dhaka",
        "farm_id": None,
    },
]

DEFAULT_NOTIFICATIONS = [
    {
        "id": "notif-001",
        "farm_id": "farm-satkhira-01",
        "channel": "IVR_VOICE",
        "message_bn": "সতর্কতা (Satkhira): মাটির লবণাক্ততা 4.8 dS/m। এখনই মিষ্টি পানির হালকা সেচ দিন।",
        "status": "SENT",
        "sent_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
    },
    {
        "id": "notif-002",
        "farm_id": "farm-bogura-01",
        "channel": "SMS",
        "message_bn": "সব ঠিক আছে (Bogura): ফসলের স্বাস্থ্য ভালো আছে। আজ সেচের প্রয়োজন নেই—ডিজেল সাশ্রয় হচ্ছে।",
        "status": "SENT",
        "sent_at": (datetime.now(timezone.utc) - timedelta(hours=12)).isoformat(),
    },
]

DEFAULT_PAYOUTS = [
    {
        "id": "pay-001",
        "farm_id": "farm-bogura-01",
        "farmer_name": "Abdul Karim (Farmer)",
        "bkash_number": "01812000003",
        "tco2e_share": 3.4,
        "amount_bdt": 4243.0,
        "provider": "BKASH",
        "status": "PAID",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=5)).isoformat(),
    },
    {
        "id": "pay-002",
        "farm_id": "farm-satkhira-01",
        "farmer_name": "Mizanur Rahman (Farmer)",
        "bkash_number": "01913000004",
        "tco2e_share": 2.1,
        "amount_bdt": 2620.0,
        "provider": "NAGAD",
        "status": "PENDING",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=1)).isoformat(),
    },
]

DEFAULT_FINANCE_COMPANIES = [
    {
        "id": "fin-001",
        "name": "BRAC Agri-Finance MFI",
        "company_type": "MFI",
        "interest_rate_pct": 9.5,
        "max_loan_bdt": 150000,
        "active": True,
    },
    {
        "id": "fin-002",
        "name": "Bangladesh Krishi Bank (Green)",
        "company_type": "BANK",
        "interest_rate_pct": 8.0,
        "max_loan_bdt": 500000,
        "active": True,
    },
    {
        "id": "fin-003",
        "name": "GreenDelta Crop Insurer",
        "company_type": "AGRI_INSURER",
        "interest_rate_pct": 6.5,
        "max_loan_bdt": 200000,
        "active": True,
    },
]

DEFAULT_LOANS = [
    {
        "id": "loan-001",
        "farm_id": "farm-bogura-01",
        "farmer_name": "Abdul Karim (Farmer)",
        "phone": "01812000003",
        "finance_company_id": "fin-001",
        "finance_company_name": "BRAC Agri-Finance MFI",
        "requested_amount_bdt": 45000,
        "credit_score": 84,
        "purpose": "AWD Solar Irrigation Pump",
        "status": "APPROVED",
        "created_at": (datetime.now(timezone.utc) - timedelta(days=3)).isoformat(),
    },
    {
        "id": "loan-002",
        "farm_id": "farm-satkhira-01",
        "farmer_name": "Mizanur Rahman (Farmer)",
        "phone": "01913000004",
        "finance_company_id": "fin-002",
        "finance_company_name": "Bangladesh Krishi Bank (Green)",
        "requested_amount_bdt": 30000,
        "credit_score": 76,
        "purpose": "Salinity-Tolerant Rice Seeds & Gypsum",
        "status": "PENDING",
        "created_at": (datetime.now(timezone.utc) - timedelta(hours=10)).isoformat(),
    },
]


def _hash_password(password: str) -> str:
    return hashlib.sha256(f"carboncredit_salt::{password}".encode("utf-8")).hexdigest()


class DatabaseService:
    """Supabase PostGIS persistence with automatic in-memory fallback."""

    def __init__(self) -> None:
        self.client = None
        self.memory_telemetry: list[dict] = []
        self.memory_users: list[dict] = [
            {**u, "password_hash": _hash_password("demo123")} for u in DEFAULT_USERS
        ]
        self.memory_notifications: list[dict] = list(DEFAULT_NOTIFICATIONS)
        self.memory_payouts: list[dict] = list(DEFAULT_PAYOUTS)
        self.memory_finance_companies: list[dict] = list(DEFAULT_FINANCE_COMPANIES)
        self.memory_loans: list[dict] = list(DEFAULT_LOANS)
        self._init_supabase()

    def _init_supabase(self) -> None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not (url and key) or "your-project-id" in url:
            return
        try:
            from supabase import create_client  # type: ignore

            self.client = create_client(url, key)
        except Exception:
            self.client = None

    @property
    def connected(self) -> bool:
        return self.client is not None

    def get_farms(self) -> list[dict]:
        if self.client is None:
            return generate_100_farms(DEFAULT_PILOT_FARMS)

        try:
            farms_res = self.client.table("farms").select("*").execute()
            rows = farms_res.data or []
            if not rows:
                return generate_100_farms(DEFAULT_PILOT_FARMS)

            # Single bulk query for recent telemetry (eliminates N+1 slowdown)
            iot_res = (
                self.client.table("iot_telemetry")
                .select("*")
                .order("recorded_at", desc=True)
                .limit(50)
                .execute()
            )
            latest_by_farm: dict[str, dict] = {}
            for iot_row in iot_res.data or []:
                fid = iot_row["farm_id"]
                if fid not in latest_by_farm:
                    latest_by_farm[fid] = iot_row

            result = []
            for row in rows:
                latest_iot = latest_by_farm.get(row["id"])
                result.append(
                    {
                        "id": row["id"],
                        "name": row["name"],
                        "district": row["district"],
                        "farmer_count": row["farmer_count"],
                        "area_acres": row["area_acres"],
                        "practice": row["practice"],
                        "center": [row["center_lat"], row["center_lng"]],
                        "polygon": row["polygon_coords"],
                        "iot": (
                            {
                                "device_id": latest_iot["device_id"],
                                "soil_moisture_pct": latest_iot["soil_moisture_pct"],
                                "salinity_dsm": latest_iot["salinity_dsm"],
                                "water_level_cm": latest_iot["water_level_cm"],
                                "battery_v": latest_iot["battery_v"],
                            }
                            if latest_iot
                            else {
                                "device_id": f"ESP32-{row['id'][:3].upper()}",
                                "soil_moisture_pct": 45.0,
                                "salinity_dsm": 1.0,
                                "water_level_cm": -5.0,
                                "battery_v": 3.9,
                            }
                        ),
                    }
                )
            return generate_100_farms(result)
        except Exception:
            return generate_100_farms(DEFAULT_PILOT_FARMS)

    def record_iot(self, payload: dict) -> dict:
        entry = {**payload, "received_at": datetime.now(timezone.utc).isoformat()}
        self.memory_telemetry.append(entry)

        if self.client is not None:
            try:
                self.client.table("iot_telemetry").insert(
                    {
                        "farm_id": payload["farm_id"],
                        "device_id": payload["device_id"],
                        "soil_moisture_pct": payload["soil_moisture_pct"],
                        "salinity_dsm": payload["salinity_dsm"],
                        "water_level_cm": payload["water_level_cm"],
                        "battery_v": payload["battery_v"],
                    }
                ).execute()
            except Exception:
                pass
        else:
            for farm in DEFAULT_PILOT_FARMS:
                if farm["id"] == payload["farm_id"]:
                    farm["iot"].update(
                        {
                            "device_id": payload["device_id"],
                            "soil_moisture_pct": payload["soil_moisture_pct"],
                            "salinity_dsm": payload["salinity_dsm"],
                            "water_level_cm": payload["water_level_cm"],
                            "battery_v": payload["battery_v"],
                        }
                    )
                    break

        return entry

    def log_satellite_and_carbon(self, farm_id: Optional[str], sat: dict, analysis: dict) -> None:
        if self.client is None or not farm_id:
            return
        try:
            self.client.table("satellite_observations").insert(
                {
                    "farm_id": farm_id,
                    "source": sat.get("provider", "UNKNOWN"),
                    "ndvi": sat["ndvi"],
                    "ndwi": sat["ndwi"],
                    "ndsi": sat["ndsi"],
                    "cloud_cover_pct": sat.get("cloud_cover_pct"),
                }
            ).execute()
            self.client.table("carbon_ledger").insert(
                {
                    "farm_id": farm_id,
                    "tco2e_estimated": analysis["carbon_aggregation"]["estimated_tco2e_per_year"],
                    "credit_score": analysis["fintech_traceability"]["credit_score"],
                    "gross_usd": analysis["carbon_aggregation"]["gross_export_usd"],
                    "farmer_payout_bdt": analysis["carbon_aggregation"]["farmer_payout_65_pct_bdt"],
                    "dmrv_status": analysis["satellite_dmrv"]["dmrv_status"],
                }
            ).execute()
        except Exception:
            pass

    # --- Users / Profiles & Auth ---
    def _sanitize_user(self, u: dict) -> dict:
        return {k: v for k, v in u.items() if k != "password_hash"}

    def get_users(self, query: Optional[str] = None) -> list[dict]:
        users = None
        if self.client is not None:
            try:
                res = self.client.table("profiles").select("*").order("created_at", desc=True).execute()
                if res.data:
                    users = [self._sanitize_user(u) for u in res.data]
            except Exception:
                pass
        if users is None:
            users = [self._sanitize_user(u) for u in self.memory_users]

        if query and query.strip():
            q = query.strip().lower()
            users = [
                u
                for u in users
                if q in u["full_name"].lower()
                or q in u["phone"].lower()
                or q in u["district"].lower()
                or q in u["role"].lower()
            ]
        return users

    def create_user(self, payload: dict) -> dict:
        pw = payload.pop("password", "demo123")
        user = {
            "id": f"usr-{uuid.uuid4().hex[:6]}",
            **payload,
            "password_hash": _hash_password(pw),
        }
        self.memory_users.insert(0, user)
        if self.client is not None:
            try:
                self.client.table("profiles").insert(user).execute()
            except Exception:
                pass
        return self._sanitize_user(user)

    def signin_user(self, phone: str, password: str) -> Optional[dict]:
        pw_hash = _hash_password(password)
        candidates = self.memory_users
        if self.client is not None:
            try:
                res = self.client.table("profiles").select("*").eq("phone", phone).limit(1).execute()
                if res.data:
                    candidates = res.data
            except Exception:
                pass

        for u in candidates:
            if u["phone"] == phone:
                stored = u.get("password_hash")
                if stored is None or stored == pw_hash:
                    return self._sanitize_user(u)
        return None

    def update_user_role(self, user_id: str, new_role: str) -> Optional[dict]:
        updated = None
        for u in self.memory_users:
            if u["id"] == user_id:
                u["role"] = new_role
                updated = self._sanitize_user(u)
                break
        if self.client is not None:
            try:
                res = (
                    self.client.table("profiles")
                    .update({"role": new_role})
                    .eq("id", user_id)
                    .execute()
                )
                if res.data:
                    updated = self._sanitize_user(res.data[0])
            except Exception:
                pass
        return updated

    # --- Finance Companies ---
    def get_finance_companies(self) -> list[dict]:
        if self.client is not None:
            try:
                res = self.client.table("finance_companies").select("*").order("created_at", desc=True).execute()
                if res.data:
                    return res.data
            except Exception:
                pass
        return self.memory_finance_companies

    def create_finance_company(self, payload: dict) -> dict:
        entry = {"id": f"fin-{uuid.uuid4().hex[:6]}", **payload, "active": True}
        self.memory_finance_companies.insert(0, entry)
        if self.client is not None:
            try:
                self.client.table("finance_companies").insert(entry).execute()
            except Exception:
                pass
        return entry

    def toggle_finance_company(self, company_id: str) -> Optional[dict]:
        updated = None
        for c in self.memory_finance_companies:
            if c["id"] == company_id:
                c["active"] = not c["active"]
                updated = c
                break
        if self.client is not None and updated is not None:
            try:
                self.client.table("finance_companies").update({"active": updated["active"]}).eq(
                    "id", company_id
                ).execute()
            except Exception:
                pass
        return updated

    # --- Loan Applications ---
    def get_loans(self, farm_id: Optional[str] = None, phone: Optional[str] = None) -> list[dict]:
        items = self.memory_loans
        if self.client is not None:
            try:
                q = self.client.table("loan_applications").select("*").order("created_at", desc=True).limit(50)
                if farm_id:
                    q = q.eq("farm_id", farm_id)
                if phone:
                    q = q.eq("phone", phone)
                res = q.execute()
                if res.data:
                    return res.data
            except Exception:
                pass
        if farm_id:
            items = [l for l in items if l["farm_id"] == farm_id]
        if phone:
            items = [l for l in items if l["phone"] == phone]
        return items

    def apply_loan(self, payload: dict) -> dict:
        entry = {
            "id": f"loan-{uuid.uuid4().hex[:6]}",
            **payload,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.memory_loans.insert(0, entry)
        if self.client is not None:
            try:
                self.client.table("loan_applications").insert(entry).execute()
            except Exception:
                pass
        return entry

    def update_loan_status(self, loan_id: str, status: str) -> Optional[dict]:
        updated = None
        for l in self.memory_loans:
            if l["id"] == loan_id:
                l["status"] = status
                updated = l
                break
        if self.client is not None:
            try:
                res = (
                    self.client.table("loan_applications")
                    .update({"status": status})
                    .eq("id", loan_id)
                    .execute()
                )
                if res.data:
                    updated = res.data[0]
            except Exception:
                pass
        return updated

    # --- Notifications ---
    def get_notifications(self, farm_id: Optional[str] = None) -> list[dict]:
        if self.client is not None:
            try:
                q = self.client.table("notifications").select("*").order("sent_at", desc=True).limit(30)
                if farm_id:
                    q = q.eq("farm_id", farm_id)
                res = q.execute()
                if res.data is not None and len(res.data) > 0:
                    return res.data
            except Exception:
                pass
        items = self.memory_notifications
        return [n for n in items if n["farm_id"] == farm_id] if farm_id else items

    def add_notification(self, farm_id: str, channel: str, message_bn: str) -> dict:
        entry = {
            "id": f"notif-{uuid.uuid4().hex[:6]}",
            "farm_id": farm_id,
            "channel": channel,
            "message_bn": message_bn,
            "status": "SENT",
            "sent_at": datetime.now(timezone.utc).isoformat(),
        }
        self.memory_notifications.insert(0, entry)
        if self.client is not None:
            try:
                self.client.table("notifications").insert(entry).execute()
            except Exception:
                pass
        return entry

    # --- Payouts ---
    def get_payouts(self, farm_id: Optional[str] = None) -> list[dict]:
        if self.client is not None:
            try:
                q = self.client.table("payouts").select("*").order("created_at", desc=True).limit(30)
                if farm_id:
                    q = q.eq("farm_id", farm_id)
                res = q.execute()
                if res.data is not None and len(res.data) > 0:
                    return res.data
            except Exception:
                pass
        items = self.memory_payouts
        return [p for p in items if p["farm_id"] == farm_id] if farm_id else items

    def create_payout(self, payload: dict) -> dict:
        entry = {
            "id": f"pay-{uuid.uuid4().hex[:6]}",
            **payload,
            "status": "PENDING",
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        self.memory_payouts.insert(0, entry)
        if self.client is not None:
            try:
                self.client.table("payouts").insert(entry).execute()
            except Exception:
                pass
        return entry

    def approve_payout(self, payout_id: str) -> Optional[dict]:
        updated = None
        for p in self.memory_payouts:
            if p["id"] == payout_id:
                p["status"] = "PAID"
                updated = p
                break
        if self.client is not None:
            try:
                res = self.client.table("payouts").update({"status": "PAID"}).eq("id", payout_id).execute()
                if res.data:
                    updated = res.data[0]
            except Exception:
                pass
        return updated

    # --- Time-Series Statistics ---
    def get_farm_timeseries(self, farm_id: str, base_ndvi: float = 0.62, base_water: float = -6.0) -> list[dict]:
        if self.client is not None:
            try:
                res = (
                    self.client.table("satellite_observations")
                    .select("ndvi, ndwi, ndsi, observed_at")
                    .eq("farm_id", farm_id)
                    .order("observed_at", desc=True)
                    .limit(6)
                    .execute()
                )
                rows = res.data or []
                if len(rows) >= 3:
                    rows.reverse()
                    return [
                        {
                            "label": r["observed_at"][:10],
                            "ndvi": round(float(r["ndvi"]), 2),
                            "ndwi": round(float(r["ndwi"]), 2),
                            "ndsi": round(float(r["ndsi"]), 2),
                            "water_cm": round(base_water + (i - 2) * 1.4, 1),
                        }
                        for i, r in enumerate(rows)
                    ]
            except Exception:
                pass

        # 30-day 6-point Sentinel-2 revisit baseline (5-day intervals)
        now = datetime.now(timezone.utc)
        offsets = [-25, -20, -15, -10, -5, 0]
        ndvi_deltas = [-0.11, -0.08, -0.05, -0.03, -0.01, 0.0]
        water_deltas = [5.0, 2.5, -1.5, -4.0, -2.0, 0.0]
        return [
            {
                "label": (now + timedelta(days=d)).strftime("%b %d"),
                "ndvi": round(max(0.2, min(0.9, base_ndvi + ndvi_deltas[i])), 2),
                "ndwi": round(-0.15 + (i * 0.04), 2),
                "ndsi": round(0.12 + (0.02 if i % 2 == 0 else 0.0), 2),
                "water_cm": round(base_water + water_deltas[i], 1),
            }
            for i, d in enumerate(offsets)
        ]
