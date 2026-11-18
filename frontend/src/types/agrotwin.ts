export type PracticeType = "AWD_RICE" | "SALINITY_SMART" | "ORGANIC_SOIL";

export interface IoTData {
  device_id: string;
  soil_moisture_pct: number;
  salinity_dsm: number;
  water_level_cm: number;
  battery_v: number;
}

export interface HybridAnalysis {
  farm_name: string;
  district: string;
  area_acres: number;
  practice: PracticeType;
  satellite_dmrv: {
    ndvi: number;
    ndwi: number;
    ndsi: number;
    cloud_cover_pct?: number | null;
    provider?: string;
    data_sources: string[];
    dmrv_status: string;
  };
  farmer_advisory: {
    status: string;
    bangla_voice_sms: string;
    estimated_irrigation_savings_pct: number;
  };
  fintech_traceability: {
    credit_score: number;
    risk_tier: string;
    recommended_loan_limit_bdt: number;
    scope3_export_ready: boolean;
  };
  carbon_aggregation: {
    estimated_tco2e_per_year: number;
    assumed_price_usd_per_ton: number;
    gross_export_usd: number;
    gross_export_bdt: number;
    farmer_payout_65_pct_bdt: number;
    startup_revenue_35_pct_bdt: number;
  };
}

export interface PilotFarm {
  id: string;
  name: string;
  district: string;
  farmer_count: number;
  area_acres: number;
  practice: PracticeType;
  center: [number, number];
  polygon: [number, number][];
  iot: IoTData;
  analysis: HybridAnalysis;
}
