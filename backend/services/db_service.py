import os
from datetime import datetime, timezone
from typing import Optional

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


class DatabaseService:
    """Supabase PostGIS persistence with automatic in-memory fallback."""

    def __init__(self) -> None:
        self.client = None
        self.memory_telemetry: list[dict] = []
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
            return DEFAULT_PILOT_FARMS

        try:
            farms_res = self.client.table("farms").select("*").execute()
            rows = farms_res.data or []
            if not rows:
                return DEFAULT_PILOT_FARMS

            result = []
            for row in rows:
                iot_res = (
                    self.client.table("iot_telemetry")
                    .select("*")
                    .eq("farm_id", row["id"])
                    .order("recorded_at", desc=True)
                    .limit(1)
                    .execute()
                )
                latest_iot = (iot_res.data or [None])[0]
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
            return result
        except Exception:
            return DEFAULT_PILOT_FARMS

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
