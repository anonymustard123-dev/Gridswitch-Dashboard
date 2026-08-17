create extension if not exists pgcrypto;
create table prospects (
 id uuid primary key default gen_random_uuid(), provider text not null default 'dataforseo', provider_place_id text, provider_feature_id text,
 name text not null, facility_type text, source_category text, address text, city text, state text, postal_code text, country_code text default 'US', latitude double precision, longitude double precision, website text, domain text, phone text,
 parcel_id text, parcel_owner text, parcel_acres double precision, parcel_sqft double precision, building_sqft double precision, building_sqft_source text, zoning text, property_class text,
 energy_factor double precision, size_score integer, opportunity_score integer, enrichment_status text not null default 'pending', match_confidence text, prospect_status text not null default 'new', notes text,
 dataforseo_raw jsonb, regrid_raw jsonb, normalized_facility_hash text generated always as (md5(lower(trim(name)) || '|' || lower(trim(coalesce(address,'')))) ) stored,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(provider, provider_place_id), unique(provider, normalized_facility_hash)
);
create index prospects_opportunity_score_idx on prospects(opportunity_score); create index prospects_facility_type_idx on prospects(facility_type); create index prospects_state_idx on prospects(state); create index prospects_city_idx on prospects(city); create index prospects_enrichment_status_idx on prospects(enrichment_status); create index prospects_coordinates_idx on prospects(latitude,longitude);
create or replace function set_updated_at() returns trigger language plpgsql as $$ begin new.updated_at=now(); return new; end $$;
create trigger prospects_updated_at before update on prospects for each row execute function set_updated_at();
