import { evidenceScore, evidenceTier } from '@/lib/evidence';
import { facilityTypeForNaics } from '@/lib/microgrid-profile';
import { ENERGY_FACTORS, opportunityScore } from '@/lib/scoring';
import type { Prospect } from '@/lib/types';

type GhgrpFacility = {
  facility_id?: number; facility_name?: string; address1?: string; city?: string; state?: string; zip?: string;
  latitude?: number; longitude?: number; frs_id?: string; eggrt_facility_id?: number; parent_company?: string | null;
  facility_types?: string; reported_industry_types?: string | null; reported_subparts?: string | null; naics_code?: string | null;
  reported_total_emissions?: number | string | null; total_reported_emissions?: number | string | null; total_co2e_emissions?: number | string | null;
};
type TriFacility = {
  tri_facility_id?: string; facility_name?: string; street_address?: string; city_name?: string; state_abbr?: string;
  zip_code?: string; pref_latitude?: number | null; pref_longitude?: number | null; epa_registry_id?: string | null;
  parent_co_name?: string | null; standardized_parent_company?: string | null; asgn_public_phone?: string | null; fac_closed_ind?: string;
  primary_naics_code?: string | null; naics_code?: string | null; industry_sector_code?: string | null; industry_sector?: string | null;
  production_ratio_or_activity_index?: number | string | null;
};
type TriNaicsRecord = {
  tri_facility_id?: string;
  naics_code?: string | null;
  primary_ind?: string | null;
};
type GhgrpEmissionRecord = {
  facility_id?: number | string;
  year?: number | string;
  co2e_emission?: number | string | null;
};

const timeoutFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(25_000) });
const ghgrpUrl = 'https://data.epa.gov/efservice/PUB_DIM_FACILITY/STATE/=/PA/ROWS/0:999/JSON';
const triUrl = 'https://data.epa.gov/efservice/tri_facility/STATE_ABBR/PA/ROWS/0:1999/JSON';
const usableCoordinate = (latitude?: number | null, longitude?: number | null) =>
  Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number(latitude) !== 0 && Number(longitude) !== 0;

export interface PublicIndustrialImport {
  rows: Partial<Prospect>[];
  sourceCounts: { ghgrp: number; tri: number; triNaics?: number; ghgrpEmissions?: number };
}

export type PublicIndustrialEnrichment = {
  triNaicsByFacilityId?: Map<string, string>;
  ghgrpEmissionsByFacilityId?: Map<string, { emissions: number; year: number }>;
};

const triNaics = (item: TriFacility) => item.primary_naics_code || item.naics_code || item.industry_sector_code || null;

/**
 * Builds a prospect universe from public facility records rather than trying
 * to prove a commercial-directory listing is industrial after the fact.
 */
export function normalizePublicIndustrialRecords(
  ghgrp: GhgrpFacility[],
  tri: TriFacility[],
  enrichment: PublicIndustrialEnrichment = {},
): PublicIndustrialImport {
  const bySite = new Map<string, Partial<Prospect>>();
  const add = (key: string, record: Partial<Prospect>, source: 'ghgrp' | 'tri', raw: unknown) => {
    const current = bySite.get(key);
    if (!current) {
      bySite.set(key, { ...record, provider: 'public_pipeline', provider_place_id: key, public_records_raw: { [source]: raw } });
      return;
    }
    const currentRaw = (current.public_records_raw ?? {}) as Record<string, unknown>;
    const programs = [...new Set([...(current.epa_programs ?? []), ...(record.epa_programs ?? [])])];
    bySite.set(key, {
      ...current,
      ...record,
      name: current.name || record.name,
      address: current.address || record.address,
      city: current.city || record.city,
      facility_type: current.epa_ghgrp_match ? current.facility_type : record.facility_type || current.facility_type,
      latitude: current.latitude ?? record.latitude,
      longitude: current.longitude ?? record.longitude,
      phone: current.phone || record.phone,
      epa_programs: programs,
      epa_ghgrp_match: Boolean(current.epa_ghgrp_match || record.epa_ghgrp_match),
      source_category: [...new Set([current.source_category, record.source_category].filter(Boolean))].join(' · '),
      public_records_raw: { ...currentRaw, [source]: raw },
    });
  };

  const directEmitters = ghgrp.filter((item) =>
    item.facility_types === 'Direct Emitter' &&
    !String(item.reported_industry_types ?? '').split(',').map((value) => value.trim()).includes('D') &&
    usableCoordinate(item.latitude, item.longitude),
  );
  for (const item of directEmitters) {
    const frsId = String(item.frs_id ?? '').trim();
    const key = frsId ? `frs:${frsId}` : `ghgrp:${item.eggrt_facility_id ?? item.facility_id}`;
    const facilityType = facilityTypeForNaics(item.naics_code);
    const reportedScale = enrichment.ghgrpEmissionsByFacilityId?.get(String(item.facility_id ?? item.eggrt_facility_id ?? ''));
    const sourceCategory = `EPA GHGRP direct emitter${item.reported_industry_types ? ` · industry codes ${item.reported_industry_types}` : ''}${item.reported_subparts ? ` · subparts ${item.reported_subparts}` : ''}`;
    const record: Partial<Prospect> = {
      name: item.facility_name || 'Unnamed EPA GHGRP facility', facility_type: facilityType, source_category: sourceCategory,
      address: item.address1 ?? null, city: item.city ?? null, state: item.state ?? 'PA', postal_code: item.zip ?? null,
      latitude: Number(item.latitude), longitude: Number(item.longitude), epa_frs_id: frsId || null,
      epa_facility_name: item.facility_name ?? null, epa_programs: ['E-GGRT'], epa_ghgrp_match: true,
      epa_match_confidence: 'source record', energy_factor: ENERGY_FACTORS[facilityType] ?? ENERGY_FACTORS.unknown,
      opportunity_score: opportunityScore(facilityType, null), enrichment_status: 'pending', prospect_status: 'new',
      public_records_verified_at: new Date().toISOString(),
      notes: item.parent_company ? `Reported parent company: ${item.parent_company}` : null,
    };
    add(key, record, 'ghgrp', {
      facility_id: item.facility_id, eggrt_facility_id: item.eggrt_facility_id, facility_types: item.facility_types,
      reported_industry_types: item.reported_industry_types, reported_subparts: item.reported_subparts,
      parent_company: item.parent_company, naics_code: item.naics_code,
      reported_total_emissions: item.reported_total_emissions,
      total_reported_emissions: item.total_reported_emissions,
      total_co2e_emissions: item.total_co2e_emissions,
      latest_reported_emissions: reportedScale?.emissions ?? null,
      emissions_reporting_year: reportedScale?.year ?? null,
    });
  }

  const activeTri = tri.filter((item) => item.fac_closed_ind !== '1' && usableCoordinate(item.pref_latitude, item.pref_longitude));
  for (const item of activeTri) {
    const frsId = String(item.epa_registry_id ?? '').trim();
    const triId = String(item.tri_facility_id ?? '').trim();
    if (!triId) continue;
    const key = frsId ? `frs:${frsId}` : `tri:${triId}`;
    // TRI primary NAICS is joined from EPA's submission-NAICS table when available.
    const naics = enrichment.triNaicsByFacilityId?.get(triId) || triNaics(item);
    const facilityType = facilityTypeForNaics(naics);
    const triCategory = item.industry_sector || (naics ? `NAICS ${naics}` : 'EPA TRI active industrial facility');
    const record: Partial<Prospect> = {
      name: item.facility_name || 'Unnamed EPA TRI facility', facility_type: facilityType, source_category: `EPA TRI active industrial facility · ${triCategory}`,
      address: item.street_address ?? null, city: item.city_name ?? null, state: item.state_abbr ?? 'PA', postal_code: item.zip_code ?? null,
      // TRI returns Pennsylvania longitudes without the western-hemisphere sign.
      latitude: Number(item.pref_latitude), longitude: -Math.abs(Number(item.pref_longitude)), phone: item.asgn_public_phone ?? null,
      epa_frs_id: frsId || null, epa_facility_name: item.facility_name ?? null, epa_programs: ['TRI'],
      epa_match_confidence: 'source record', energy_factor: ENERGY_FACTORS[facilityType] ?? ENERGY_FACTORS.unknown,
      opportunity_score: opportunityScore(facilityType, null), enrichment_status: 'pending', prospect_status: 'new',
      public_records_verified_at: new Date().toISOString(),
      notes: item.parent_co_name && item.parent_co_name !== 'NA' ? `Reported parent company: ${item.parent_co_name}` : null,
    };
    add(key, record, 'tri', {
      tri_facility_id: item.tri_facility_id, epa_registry_id: item.epa_registry_id,
      parent_co_name: item.parent_co_name, standardized_parent_company: item.standardized_parent_company,
      fac_closed_ind: item.fac_closed_ind, primary_naics_code: naics,
      naics_code: item.naics_code, industry_sector_code: item.industry_sector_code,
      industry_sector: item.industry_sector, production_ratio_or_activity_index: item.production_ratio_or_activity_index,
    });
  }

  const rows = [...bySite.values()].map((row) => {
    const evidence = { facilityType: row.facility_type, epaFrsId: row.epa_frs_id, epaGhgrpMatch: row.epa_ghgrp_match };
    return { ...row, evidence_score: evidenceScore(evidence), evidence_tier: evidenceTier(evidence) };
  });
  return {
    rows,
    sourceCounts: {
      ghgrp: directEmitters.length,
      tri: activeTri.length,
      triNaics: enrichment.triNaicsByFacilityId?.size,
      ghgrpEmissions: enrichment.ghgrpEmissionsByFacilityId?.size,
    },
  };
}

const EPA_TIMEOUT_MS = 12_000;
const MAX_EPA_CONCURRENCY = 24;

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(EPA_TIMEOUT_MS) });
    if (!response.ok) return null;
    const body = await response.json() as T | { value?: T };
    return (body && typeof body === 'object' && 'value' in body ? body.value : body) as T;
  } catch {
    return null;
  }
}

async function mapConcurrent<T, R>(items: T[], work: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  let cursor = 0;
  const workers = Array.from({ length: Math.min(MAX_EPA_CONCURRENCY, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await work(items[index]);
    }
  });
  await Promise.all(workers);
  return results;
}

/** EPA publishes TRI primary NAICS separately from its facility table. */
async function fetchTriPrimaryNaics(tri: TriFacility[]): Promise<Map<string, string>> {
  const facilityIds = [...new Set(tri.map((item) => String(item.tri_facility_id ?? '').trim()).filter(Boolean))];
  const responses = await mapConcurrent(facilityIds, async (facilityId) => {
    const url = `https://data.epa.gov/efservice/tri_submission_naics/TRI_FACILITY_ID/=/${encodeURIComponent(facilityId)}/PRIMARY_IND/=/1/ROWS/0:49/JSON`;
    return { facilityId, rows: await fetchJson<TriNaicsRecord[]>(url) };
  });
  const result = new Map<string, string>();
  for (const { facilityId, rows } of responses) {
    const naics = rows?.find((row) => String(row.primary_ind ?? '') === '1' && row.naics_code)?.naics_code;
    if (naics) result.set(facilityId, String(naics));
  }
  return result;
}

/** GHGRP's annual reported emissions are stored in an EPA fact table. */
async function fetchGhgrpReportedEmissions(ghgrp: GhgrpFacility[]): Promise<Map<string, { emissions: number; year: number }>> {
  const ids = [...new Set(ghgrp.map((item) => String(item.facility_id ?? item.eggrt_facility_id ?? '').trim()).filter(Boolean))];
  const responses = await mapConcurrent(ids, async (facilityId) => {
    const url = `https://data.epa.gov/efservice/PUB_FACTS_SECTOR_GHG_EMISSION/FACILITY_ID/=/${encodeURIComponent(facilityId)}/ROWS/0:499/JSON`;
    return { facilityId, rows: await fetchJson<GhgrpEmissionRecord[]>(url) };
  });
  const result = new Map<string, { emissions: number; year: number }>();
  for (const { facilityId, rows } of responses) {
    const years = (rows ?? []).map((row) => Number(row.year)).filter(Number.isFinite);
    const latestYear = Math.max(...years);
    if (!Number.isFinite(latestYear)) continue;
    const emissions = (rows ?? [])
      .filter((row) => Number(row.year) === latestYear)
      .reduce((total, row) => total + Math.max(0, Number(row.co2e_emission) || 0), 0);
    if (emissions > 0) result.set(facilityId, { emissions, year: latestYear });
  }
  return result;
}

export async function fetchPennsylvaniaPublicIndustrialRecords(): Promise<PublicIndustrialImport> {
  const [ghgrpResponse, triResponse] = await Promise.all([timeoutFetch(ghgrpUrl), timeoutFetch(triUrl)]);
  if (!ghgrpResponse.ok || !triResponse.ok) throw new Error('EPA public facility data is temporarily unavailable.');
  const [ghgrp, tri] = await Promise.all([
    ghgrpResponse.json() as Promise<GhgrpFacility[]>,
    triResponse.json() as Promise<TriFacility[]>,
  ]);
  const ghgrpFacilities = Array.isArray(ghgrp) ? ghgrp : [];
  const triFacilities = Array.isArray(tri) ? tri : [];
  const directEmitters = ghgrpFacilities.filter((item) => item.facility_types === 'Direct Emitter' && usableCoordinate(item.latitude, item.longitude));
  const activeTri = triFacilities.filter((item) => item.fac_closed_ind !== '1' && usableCoordinate(item.pref_latitude, item.pref_longitude));
  const [triNaicsByFacilityId, ghgrpEmissionsByFacilityId] = await Promise.all([
    fetchTriPrimaryNaics(activeTri),
    fetchGhgrpReportedEmissions(directEmitters),
  ]);
  return normalizePublicIndustrialRecords(ghgrpFacilities, triFacilities, { triNaicsByFacilityId, ghgrpEmissionsByFacilityId });
}
