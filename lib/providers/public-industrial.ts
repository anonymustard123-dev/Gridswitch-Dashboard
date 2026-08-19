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
type GhgrpEmissionRecord = {
  facility_id?: number | string;
  year?: number | string;
  co2e_emission?: number | string | null;
};

const timeoutFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(25_000) });
const ghgrpUrl = 'https://data.epa.gov/efservice/PUB_DIM_FACILITY/STATE/=/PA/ROWS/0:999/JSON';
const triUrl = 'https://data.epa.gov/efservice/tri_facility/STATE_ABBR/PA/ROWS/0:1999/JSON';
// The annual TRI Basic file contains NAICS and production-related reporting for
// every Pennsylvania TRI facility. One bulk download is substantially more
// reliable than hundreds of per-facility requests during a dashboard refresh.
const TRI_BULK_REPORTING_YEARS = [2024, 2023, 2022] as const;
const triBulkUrl = (year: number) => `https://data.epa.gov/efservice/downloads/tri/mv_tri_basic_download/${year}_PA/csv`;
const usableCoordinate = (latitude?: number | null, longitude?: number | null) =>
  Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number(latitude) !== 0 && Number(longitude) !== 0;

export interface PublicIndustrialImport {
  rows: Partial<Prospect>[];
  sourceCounts: { ghgrp: number; tri: number; triProfiles?: number; ghgrpEmissions?: number };
}

export type PublicIndustrialEnrichment = {
  triProfilesByFacilityId?: Map<string, TriBulkProfile>;
  ghgrpEmissionsByFacilityId?: Map<string, { emissions: number; year: number }>;
};

type TriBulkProfile = {
  naics: string;
  industrySector: string | null;
  productionWasteLbs: number;
  productionRatio: number | null;
  reportingYear: number;
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
    // EPA's bulk TRI file carries the primary NAICS omitted from the facility table.
    const triProfile = enrichment.triProfilesByFacilityId?.get(triId);
    const naics = triProfile?.naics || triNaics(item);
    const facilityType = facilityTypeForNaics(naics);
    const triCategory = triProfile?.industrySector || item.industry_sector || (naics ? `NAICS ${naics}` : 'EPA TRI active industrial facility');
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
      industry_sector: triProfile?.industrySector || item.industry_sector,
      production_ratio_or_activity_index: triProfile?.productionRatio ?? item.production_ratio_or_activity_index,
      reported_production_waste_lbs: triProfile?.productionWasteLbs ?? null,
      tri_reporting_year: triProfile?.reportingYear ?? null,
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
      triProfiles: enrichment.triProfilesByFacilityId?.size,
      ghgrpEmissions: enrichment.ghgrpEmissionsByFacilityId?.size,
    },
  };
}

const EPA_TIMEOUT_MS = 12_000;
const MAX_EPA_CONCURRENCY = 8;

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

function parseCsvRows(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let value = '';
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (inQuotes && text[index + 1] === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (character === ',' && !inQuotes) {
      row.push(value);
      value = '';
    } else if ((character === '\n' || character === '\r') && !inQuotes) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(value);
      if (row.some((cell) => cell.length > 0)) rows.push(row);
      row = [];
      value = '';
    } else {
      value += character;
    }
  }
  if (value.length > 0 || row.length > 0) {
    row.push(value);
    rows.push(row);
  }
  return rows;
}

const csvNumber = (value: string | undefined) => {
  const parsed = Number(String(value ?? '').replaceAll(',', '').trim());
  return Number.isFinite(parsed) ? parsed : 0;
};

/**
 * Retrieves the three most recent Pennsylvania TRI Basic files, keeping the
 * newest available record for each active facility. TRI repeats a facility on
 * multiple chemical rows, so production-related quantities are summed.
 */
async function fetchPennsylvaniaTriBulkProfiles(tri: TriFacility[]): Promise<Map<string, TriBulkProfile>> {
  const facilityIds = new Set(tri.map((item) => String(item.tri_facility_id ?? '').trim()).filter(Boolean));
  if (!facilityIds.size) return new Map();

  try {
    const profiles = new Map<string, TriBulkProfile>();
    const files = await Promise.all(TRI_BULK_REPORTING_YEARS.map(async (year) => {
      try {
        const response = await fetch(triBulkUrl(year), { signal: AbortSignal.timeout(45_000) });
        return response.ok ? { year, rows: parseCsvRows(await response.text()) } : null;
      } catch {
        return null;
      }
    }));

    for (const file of files) {
      if (!file) continue;
      const [headers, ...data] = file.rows;
      if (!headers) continue;
      const indexByHeader = new Map(headers.map((header, index) => [header.trim(), index]));
      const column = (name: string) => indexByHeader.get(name);
      const triIdColumn = column('2. TRIFD');
      const naicsColumn = column('30. PRIMARY NAICS');
      const sectorColumn = column('23. INDUSTRY SECTOR');
      const productionWasteColumn = column('119. PRODUCTION WSTE (8.1-8.7)');
      const productionRatioColumn = column('122. 8.9 - PRODUCTION RATIO') ?? column('121. PROD_RATIO_OR_ ACTIVITY');
      if (triIdColumn === undefined) continue;

      for (const row of data) {
        const facilityId = row[triIdColumn]?.trim();
        if (!facilityId || !facilityIds.has(facilityId)) continue;
        const existing = profiles.get(facilityId);
        // Preserve the newest available annual reporting record for a facility.
        if (existing && existing.reportingYear > file.year) continue;
        const naics = naicsColumn === undefined ? '' : row[naicsColumn]?.trim() ?? '';
        const sector = sectorColumn === undefined ? '' : row[sectorColumn]?.trim() ?? '';
        const ratio = productionRatioColumn === undefined ? 0 : csvNumber(row[productionRatioColumn]);
        profiles.set(facilityId, {
          naics: existing?.naics || naics,
          industrySector: existing?.industrySector || sector || null,
          productionWasteLbs: (existing?.reportingYear === file.year ? existing.productionWasteLbs : 0) + (productionWasteColumn === undefined ? 0 : Math.max(0, csvNumber(row[productionWasteColumn]))),
          productionRatio: Math.max(existing?.reportingYear === file.year ? existing.productionRatio ?? 0 : 0, ratio) || null,
          reportingYear: file.year,
        });
      }
    }
    return profiles;
  } catch {
    return new Map();
  }
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
  const [triProfilesByFacilityId, ghgrpEmissionsByFacilityId] = await Promise.all([
    fetchPennsylvaniaTriBulkProfiles(activeTri),
    fetchGhgrpReportedEmissions(directEmitters),
  ]);
  return normalizePublicIndustrialRecords(ghgrpFacilities, triFacilities, { triProfilesByFacilityId, ghgrpEmissionsByFacilityId });
}
