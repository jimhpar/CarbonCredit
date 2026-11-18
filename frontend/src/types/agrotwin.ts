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
  carbon_rank?: number;
  center: [number, number];
  polygon: [number, number][];
  iot: IoTData;
  analysis: HybridAnalysis;
}

export type UserRole = "farmer" | "field_agent" | "b2b_partner" | "admin";

export interface UserProfile {
  id: string;
  full_name: string;
  role: UserRole;
  phone: string;
  bkash_number?: string | null;
  district: string;
  farm_id?: string | null;
}

export interface NotificationItem {
  id: string;
  farm_id: string;
  channel: "SMS" | "IVR_VOICE" | "IN_APP";
  message_bn: string;
  status: string;
  sent_at: string;
}

export interface PayoutItem {
  id: string;
  farm_id: string;
  farmer_name: string;
  bkash_number: string;
  tco2e_share: number;
  amount_bdt: number;
  provider: "BKASH" | "NAGAD";
  status: "PENDING" | "PAID";
  created_at: string;
}

export interface TimeSeriesPoint {
  label: string;
  ndvi: number;
  ndwi: number;
  ndsi: number;
  water_cm: number;
}

export interface FinanceCompany {
  id: string;
  name: string;
  company_type: "MFI" | "BANK" | "AGRI_INSURER";
  interest_rate_pct: number;
  max_loan_bdt: number;
  active: boolean;
}

export interface LoanApplication {
  id: string;
  farm_id: string;
  farmer_name: string;
  phone: string;
  finance_company_id: string;
  finance_company_name: string;
  requested_amount_bdt: number;
  credit_score: number;
  purpose: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  created_at: string;
}
