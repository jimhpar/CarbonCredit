import hashlib
import json
import os
import time
from datetime import datetime, timedelta, timezone
from typing import Optional
import httpx


def _to_geojson_ring(polygon_lat_lng: list[list[float]]) -> list[list[float]]:
    """Convert [[lat, lng], ...] to closed GeoJSON [[lng, lat], ...]."""
    ring = [[pt[1], pt[0]] for pt in polygon_lat_lng if len(pt) >= 2]
    if ring and ring[0] != ring[-1]:
        ring.append(ring[0])
    return ring


class SatelliteService:
    """Fetches NDVI, NDWI, NDSI from Google Earth Engine or Sentinel Hub, with 5-min TTL cache."""

    def __init__(self) -> None:
        self.gee_ready = False
        self.sentinel_hub_ready = bool(
            os.getenv("SENTINELHUB_CLIENT_ID") and os.getenv("SENTINELHUB_CLIENT_SECRET")
        )
        self._cache: dict[str, tuple[float, dict]] = {}
        self._cache_ttl_sec = 300.0
        self._init_gee()

    def _init_gee(self) -> None:
        sa = os.getenv("GEE_SERVICE_ACCOUNT")
        key_file = os.getenv("GEE_PRIVATE_KEY_FILE")
        project_id = os.getenv("GEE_PROJECT_ID")

        if not (sa and key_file and os.path.exists(key_file)):
            return

        try:
            import ee  # type: ignore

            creds = ee.ServiceAccountCredentials(sa, key_file)
            if project_id:
                ee.Initialize(credentials=creds, project=project_id)
            else:
                ee.Initialize(credentials=creds)
            self.gee_ready = True
        except Exception:
            self.gee_ready = False

    def status(self) -> dict:
        return {
            "gee_connected": self.gee_ready,
            "sentinel_hub_connected": self.sentinel_hub_ready,
            "active_provider": (
                "Google Earth Engine (Sentinel-2 + Sentinel-1)"
                if self.gee_ready
                else "Sentinel Hub Statistical API"
                if self.sentinel_hub_ready
                else "Calibrated Simulation (Add GEE or Sentinel Hub keys in backend/.env)"
            ),
        }

    def fetch_indices(
        self,
        polygon_lat_lng: list[list[float]],
        soil_moisture_pct: float,
        salinity_dsm: float,
        water_level_cm: float,
    ) -> dict:
        cache_key = hashlib.md5(json.dumps(polygon_lat_lng).encode()).hexdigest()
        cached = self._cache.get(cache_key)
        if cached and (time.time() - cached[0]) < self._cache_ttl_sec:
            return cached[1]

        if self.gee_ready:
            gee_result = self._fetch_from_gee(polygon_lat_lng)
            if gee_result is not None:
                self._cache[cache_key] = (time.time(), gee_result)
                return gee_result

        if self.sentinel_hub_ready:
            sh_result = self._fetch_from_sentinel_hub(polygon_lat_lng)
            if sh_result is not None:
                self._cache[cache_key] = (time.time(), sh_result)
                return sh_result

        # Fallback: IoT-calibrated index simulation
        ndvi = round(min(0.88, max(0.25, 0.45 + (soil_moisture_pct / 160.0) - (salinity_dsm * 0.025))), 2)
        ndwi = round(min(0.65, max(-0.40, (water_level_cm / 40.0) + (soil_moisture_pct - 40) / 120.0)), 2)
        ndsi = round(min(0.85, max(0.05, salinity_dsm / 10.0)), 2)
        return {
            "ndvi": ndvi,
            "ndwi": ndwi,
            "ndsi": ndsi,
            "cloud_cover_pct": None,
            "provider": "SIMULATED_FALLBACK",
            "data_sources": [
                "Sentinel-2 (Simulated — set GEE/SentinelHub in .env for live)",
                "ESP32 Reference IoT",
            ],
        }

    def _fetch_from_gee(self, polygon_lat_lng: list[list[float]]) -> Optional[dict]:
        try:
            import ee  # type: ignore

            ring = _to_geojson_ring(polygon_lat_lng)
            geom = ee.Geometry.Polygon([ring])
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=30)

            s2 = (
                ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
                .filterBounds(geom)
                .filterDate(start_dt.strftime("%Y-%m-%d"), end_dt.strftime("%Y-%m-%d"))
                .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 35))
                .sort("CLOUDY_PIXEL_PERCENTAGE")
            )

            img = s2.first()
            info = img.getInfo()
            if not info:
                return None

            ndvi_img = img.normalizedDifference(["B8", "B4"]).rename("ndvi")
            ndwi_img = img.normalizedDifference(["B3", "B8"]).rename("ndwi")
            # Salinity proxy using SWIR1 (B11) and NIR (B8)
            ndsi_img = img.normalizedDifference(["B11", "B8"]).rename("ndsi")
            combined = ndvi_img.addBands([ndwi_img, ndsi_img])

            stats = combined.reduceRegion(
                reducer=ee.Reducer.mean(),
                geometry=geom,
                scale=10,
                maxPixels=1e7,
            ).getInfo()

            cloud_pct = info.get("properties", {}).get("CLOUDY_PIXEL_PERCENTAGE")
            return {
                "ndvi": round(float(stats.get("ndvi") or 0.55), 3),
                "ndwi": round(float(stats.get("ndwi") or 0.10), 3),
                "ndsi": round(max(0.0, float(stats.get("ndsi") or 0.15)), 3),
                "cloud_cover_pct": round(float(cloud_pct), 1) if cloud_pct is not None else None,
                "provider": "GEE_SENTINEL2_LIVE",
                "data_sources": [
                    "Google Earth Engine (COPERNICUS/S2_SR_HARMONIZED)",
                    "ESP32 Reference IoT",
                ],
            }
        except Exception:
            return None

    def _fetch_from_sentinel_hub(self, polygon_lat_lng: list[list[float]]) -> Optional[dict]:
        client_id = os.getenv("SENTINELHUB_CLIENT_ID")
        client_secret = os.getenv("SENTINELHUB_CLIENT_SECRET")
        if not (client_id and client_secret):
            return None

        try:
            ring = _to_geojson_ring(polygon_lat_lng)
            end_dt = datetime.now(timezone.utc)
            start_dt = end_dt - timedelta(days=30)

            with httpx.Client(timeout=15.0) as client:
                token_res = client.post(
                    "https://services.sentinel-hub.com/auth/realms/main/protocol/openid-connect/token",
                    data={
                        "grant_type": "client_credentials",
                        "client_id": client_id,
                        "client_secret": client_secret,
                    },
                )
                token_res.raise_for_status()
                access_token = token_res.json()["access_token"]

                evalscript = """//VERSION=3
function setup() {
  return {
    input: [{ bands: ["B03", "B04", "B08", "B11", "dataMask"] }],
    output: [
      { id: "indices", bands: 3 },
      { id: "dataMask", bands: 1 }
    ]
  };
}
function evaluatePixel(s) {
  let ndvi = (s.B08 - s.B04) / (s.B08 + s.B04 + 1e-6);
  let ndwi = (s.B03 - s.B08) / (s.B03 + s.B08 + 1e-6);
  let ndsi = (s.B11 - s.B08) / (s.B11 + s.B08 + 1e-6);
  return { indices: [ndvi, ndwi, ndsi], dataMask: [s.dataMask] };
}"""

                payload = {
                    "input": {
                        "bounds": {"geometry": {"type": "Polygon", "coordinates": [ring]}},
                        "data": [{"type": "sentinel-2-l2a", "dataFilter": {"maxCloudCoverage": 35}}],
                    },
                    "aggregation": {
                        "timeRange": {
                            "from": start_dt.strftime("%Y-%m-%dT00:00:00Z"),
                            "to": end_dt.strftime("%Y-%m-%dT23:59:59Z"),
                        },
                        "aggregationInterval": {"of": "P30D"},
                        "evalscript": evalscript,
                    },
                }

                stat_res = client.post(
                    "https://services.sentinel-hub.com/api/v1/statistics",
                    headers={"Authorization": f"Bearer {access_token}"},
                    json=payload,
                )
                stat_res.raise_for_status()
                data = stat_res.json().get("data", [])
                if not data:
                    return None
                bands = data[0]["outputs"]["indices"]["bands"]
                return {
                    "ndvi": round(float(bands["B0"]["stats"]["mean"]), 3),
                    "ndwi": round(float(bands["B1"]["stats"]["mean"]), 3),
                    "ndsi": round(max(0.0, float(bands["B2"]["stats"]["mean"])), 3),
                    "cloud_cover_pct": None,
                    "provider": "SENTINEL_HUB_LIVE",
                    "data_sources": [
                        "Sentinel Hub Statistical API (S2 L2A)",
                        "ESP32 Reference IoT",
                    ],
                }
        except Exception:
            return None
