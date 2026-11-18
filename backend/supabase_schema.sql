-- AgroTwin AI — Supabase + PostGIS Schema
-- Run this in Supabase SQL Editor (Dashboard -> SQL Editor -> New Query)

create extension if not exists postgis;

create table if not exists public.farms (
  id text primary key,
  name text not null,
  district text not null,
  farmer_count integer not null default 1,
  area_acres double precision not null,
  practice text not null check (practice in ('AWD_RICE', 'SALINITY_SMART', 'ORGANIC_SOIL')),
  center_lat double precision not null,
  center_lng double precision not null,
  polygon_coords jsonb not null,
  geom geometry(Polygon, 4326),
  created_at timestamptz not null default now()
);

create index if not exists idx_farms_geom on public.farms using gist (geom);

create table if not exists public.iot_telemetry (
  id bigserial primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  device_id text not null,
  soil_moisture_pct double precision not null,
  salinity_dsm double precision not null,
  water_level_cm double precision not null,
  battery_v double precision not null default 3.85,
  recorded_at timestamptz not null default now()
);

create index if not exists idx_iot_farm_time on public.iot_telemetry (farm_id, recorded_at desc);

create table if not exists public.satellite_observations (
  id bigserial primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  source text not null,
  ndvi double precision not null,
  ndwi double precision not null,
  ndsi double precision not null,
  cloud_cover_pct double precision,
  observed_at timestamptz not null default now()
);

create table if not exists public.carbon_ledger (
  id bigserial primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  tco2e_estimated double precision not null,
  credit_score integer not null,
  gross_usd double precision not null,
  farmer_payout_bdt double precision not null,
  dmrv_status text not null,
  created_at timestamptz not null default now()
);

-- Seed 3 Bangladesh Pilot Clusters
insert into public.farms (id, name, district, farmer_count, area_acres, practice, center_lat, center_lng, polygon_coords, geom)
values
  (
    'farm-bogura-01',
    'Sherpur Boro AWD Cluster',
    'Bogura',
    48,
    65.0,
    'AWD_RICE',
    24.6712,
    89.4173,
    '[[24.6700, 89.4155], [24.6725, 89.4155], [24.6725, 89.4192], [24.6700, 89.4192]]'::jsonb,
    st_geomfromtext('POLYGON((89.4155 24.6700, 89.4192 24.6700, 89.4192 24.6725, 89.4155 24.6725, 89.4155 24.6700))', 4326)
  ),
  (
    'farm-satkhira-01',
    'Shyamnagar Coastal Salinity Block',
    'Satkhira',
    35,
    42.0,
    'SALINITY_SMART',
    22.3306,
    89.1028,
    '[[22.3292, 89.1010], [22.3320, 89.1010], [22.3320, 89.1046], [22.3292, 89.1046]]'::jsonb,
    st_geomfromtext('POLYGON((89.1010 22.3292, 89.1046 22.3292, 89.1046 22.3320, 89.1010 22.3320, 89.1010 22.3292))', 4326)
  ),
  (
    'farm-rajshahi-01',
    'Godagari Drought-Resilient Plot',
    'Rajshahi',
    28,
    36.0,
    'ORGANIC_SOIL',
    24.4667,
    88.3306,
    '[[24.4654, 88.3290], [24.4680, 88.3290], [24.4680, 88.3322], [24.4654, 88.3322]]'::jsonb,
    st_geomfromtext('POLYGON((88.3290 24.4654, 88.3322 24.4654, 88.3322 24.4680, 88.3290 24.4680, 88.3290 24.4654))', 4326)
  )
on conflict (id) do nothing;

insert into public.iot_telemetry (farm_id, device_id, soil_moisture_pct, salinity_dsm, water_level_cm, battery_v)
values
  ('farm-bogura-01', 'ESP32-BOG-01', 54.0, 0.6, -7.5, 4.02),
  ('farm-satkhira-01', 'ESP32-SAT-04', 38.5, 4.8, 1.5, 3.79),
  ('farm-rajshahi-01', 'ESP32-RAJ-02', 29.0, 0.9, -12.0, 3.91);

-- --- Step 1-3 Additions: Users, Notifications, Payouts ---

create table if not exists public.profiles (
  id text primary key,
  full_name text not null,
  role text not null check (role in ('farmer', 'field_agent', 'b2b_partner', 'admin')),
  phone text not null,
  password_hash text,
  bkash_number text,
  district text not null,
  farm_id text references public.farms(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists public.finance_companies (
  id text primary key,
  name text not null,
  company_type text not null check (company_type in ('MFI', 'BANK', 'AGRI_INSURER')),
  interest_rate_pct double precision not null,
  max_loan_bdt double precision not null,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.loan_applications (
  id text primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  farmer_name text not null,
  phone text not null,
  finance_company_id text not null,
  finance_company_name text not null,
  requested_amount_bdt double precision not null,
  credit_score integer not null,
  purpose text not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'APPROVED', 'REJECTED')),
  created_at timestamptz not null default now()
);

create table if not exists public.notifications (
  id text primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  channel text not null check (channel in ('SMS', 'IVR_VOICE', 'IN_APP')),
  message_bn text not null,
  status text not null default 'SENT',
  sent_at timestamptz not null default now()
);

create table if not exists public.payouts (
  id text primary key,
  farm_id text not null references public.farms(id) on delete cascade,
  farmer_name text not null,
  bkash_number text not null,
  tco2e_share double precision not null,
  amount_bdt double precision not null,
  provider text not null default 'BKASH',
  status text not null default 'PENDING' check (status in ('PENDING', 'PAID')),
  created_at timestamptz not null default now()
);

insert into public.profiles (id, full_name, role, phone, bkash_number, district, farm_id)
values
  ('usr-admin-01', 'Zim (Platform Admin)', 'admin', '01700000001', null, 'Dhaka', null),
  ('usr-agent-01', 'Rafiqul Islam (Field Agent)', 'field_agent', '01711000002', '01711000002', 'Bogura', 'farm-bogura-01'),
  ('usr-farmer-01', 'Abdul Karim (Farmer)', 'farmer', '01812000003', '01812000003', 'Bogura', 'farm-bogura-01'),
  ('usr-farmer-02', 'Mizanur Rahman (Farmer)', 'farmer', '01913000004', '01913000004', 'Satkhira', 'farm-satkhira-01'),
  ('usr-b2b-01', 'GreenBank MFI Partner', 'b2b_partner', '01755000005', null, 'Dhaka', null)
on conflict (id) do nothing;
