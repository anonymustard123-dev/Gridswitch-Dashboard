alter table prospects
  add column if not exists epa_frs_id text,
  add column if not exists epa_facility_name text,
  add column if not exists epa_programs text[] not null default '{}',
  add column if not exists epa_ghgrp_match boolean not null default false,
  add column if not exists epa_match_confidence text,
  add column if not exists pa_dep_facility_id text,
  add column if not exists pa_dep_facility_name text,
  add column if not exists pa_dep_facility_type text,
  add column if not exists pa_dep_match_confidence text,
  add column if not exists building_footprint_sqft double precision,
  add column if not exists building_footprint_source text,
  add column if not exists footprint_match_confidence text,
  add column if not exists evidence_score integer not null default 0,
  add column if not exists evidence_tier text not null default 'needs_review',
  add column if not exists public_records_verified_at timestamptz,
  add column if not exists public_records_raw jsonb;

create index if not exists prospects_evidence_score_idx on prospects(evidence_score);
create index if not exists prospects_evidence_tier_idx on prospects(evidence_tier);

update prospects
set evidence_score = case when coalesce(facility_type, 'unknown') <> 'unknown' then 20 else 0 end,
    evidence_tier = case when coalesce(facility_type, 'unknown') <> 'unknown' then 'site_signal' else 'needs_review' end
where evidence_score = 0 and public_records_verified_at is null;
