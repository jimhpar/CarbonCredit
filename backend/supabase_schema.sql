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
