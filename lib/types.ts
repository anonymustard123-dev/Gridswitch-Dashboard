export type EnrichmentStatus = 'pending' | 'enriching' | 'complete' | 'partial' | 'failed';
export type ProspectStatus = 'new' | 'qualified' | 'rejected';
export interface Prospect {
  id: string; provider: string; provider_place_id?: string | null; name: string; facility_type: string | null;
  source_category?: string | null; address?: string | null; city?: string | null; state?: string | null; postal_code?: string | null;
  latitude?: number | null; longitude?: number | null; website?: string | null; phone?: string | null;
  parcel_id?: string | null; parcel_owner?: string | null; parcel_acres?: number | null; parcel_sqft?: number | null;
  building_sqft?: number | null; building_sqft_source?: string | null; zoning?: string | null; property_class?: string | null;
  energy_factor?: number | null; size_score?: number | null; opportunity_score?: number | null;
  enrichment_status: EnrichmentStatus; match_confidence?: string | null; prospect_status: ProspectStatus; notes?: string | null;
  created_at?: string; updated_at?: string; dataforseo_raw?: unknown; regrid_raw?: unknown;
}
export interface SearchInput { centerLatitude:number; centerLongitude:number; radiusKm:number; state:string; categories:string[]; limit:number }
