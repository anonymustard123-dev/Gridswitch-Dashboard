export type EnrichmentStatus = 'pending' | 'enriching' | 'complete' | 'partial' | 'failed';
export type ProspectStatus = 'new' | 'qualified' | 'rejected';
export interface Prospect {
  id: string; provider: string; provider_place_id?: string | null; name: string; facility_type: string | null;
  source_category?: string | null; address?: string | null; city?: string | null; state?: string | null; postal_code?: string | null;
  latitude?: number | null; longitude?: number | null; website?: string | null; phone?: string | null;
  parcel_id?: string | null; parcel_owner?: string | null; parcel_acres?: number | null; parcel_sqft?: number | null;
  building_sqft?: number | null; building_sqft_source?: string | null; zoning?: string | null; property_class?: string | null;
  energy_factor?: number | null; size_score?: number | null; opportunity_score?: number | null;
  epa_frs_id?: string | null; epa_facility_name?: string | null; epa_programs?: string[] | null; epa_ghgrp_match?: boolean | null; epa_match_confidence?: string | null;
  pa_dep_facility_id?: string | null; pa_dep_facility_name?: string | null; pa_dep_facility_type?: string | null; pa_dep_match_confidence?: string | null;
  building_footprint_sqft?: number | null; building_footprint_source?: string | null; footprint_match_confidence?: string | null;
  evidence_score?: number | null; evidence_tier?: 'needs_review' | 'site_signal' | 'priority_outreach' | 'high_evidence' | null; public_records_verified_at?: string | null;
  enrichment_status: EnrichmentStatus; match_confidence?: string | null; prospect_status: ProspectStatus; notes?: string | null;
  created_at?: string; updated_at?: string; dataforseo_raw?: unknown; regrid_raw?: unknown;
  ai_research_status?: 'pending' | 'researching' | 'complete' | 'failed' | null; ai_research?: AiFacilityResearch | null; ai_researched_at?: string | null; ai_model?: string | null; ai_error?: string | null;
}
export interface SearchInput { centerLatitude:number; centerLongitude:number; radiusKm:number; state:string; categories:string[]; limit:number }

export interface AiResearchSource { title: string; url: string; }
export interface AiResearchClaim { claim: string; evidence_type: 'operations' | 'scale' | 'expansion' | 'resilience' | 'energy' | 'other'; confidence: 'high' | 'medium' | 'low'; source_url: string; }
export interface AiFacilityResearch {
  facility_summary: string;
  grid_switch_fit: 'high' | 'moderate' | 'low' | 'unknown';
  fit_reasons: string[];
  operating_evidence: AiResearchClaim[];
  outreach_angle: string;
  discovery_questions: string[];
  unknowns: string[];
  sources: AiResearchSource[];
}
