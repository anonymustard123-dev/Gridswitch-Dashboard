import { evidenceScore, evidenceTier } from '@/lib/evidence';
import { ENERGY_FACTORS, opportunityScore } from '@/lib/scoring';
import type { Prospect } from '@/lib/types';

type GhgrpFacility = {
  facility_id?: number; facility_name?: string; address1?: string; city?: string; state?: string; zip?: string;
  latitude?: number; longitude?: number; frs_id?: string; eggrt_facility_id?: number; parent_company?: string | null;
  facility_types?: string; reported_industry_types?: string | null; reported_subparts?: string | null;
};
type TriFacility = {
  tri_facility_id?: string; facility_name?: string; street_address?: string; city_name?: string; state_abbr?: string;
  zip_code?: string; pref_latitude?: number | null; pref_longitude?: number | null; epa_registry_id?: string | null;
  parent_co_name?: string | null; asgn_public_phone?: string | null; fac_closed_ind?: string;
};

const timeoutFetch = (url: string) => fetch(url, { signal: AbortSignal.timeout(25_000) });
const ghgrpUrl = 'https://data.epa.gov/efservice/PUB_DIM_FACILITY/STATE/=/PA/ROWS/0:999/JSON';
const triUrl = 'https://data.epa.gov/efservice/tri_facility/STATE_ABBR/PA/ROWS/0:1999/JSON';
const usableCoordinate = (latitude?: number | null, longitude?: number | null) =>
  Number.isFinite(Number(latitude)) && Number.isFinite(Number(longitude)) && Number(latitude) !== 0 && Number(longitude) !== 0;

export interface PublicIndustrialImport {
  rows: Partial<Prospect>[];
  sourceCounts: { ghgrp: number; tri: number };
}

/**
 * Builds a prospect universe from public facility records rather than trying
 * to prove a commercial-directory listing is industrial after the fact.
 */
export function normalizePublicIndustrialRecords(ghgrp: GhgrpFacility[], tri: TriFacility[]): PublicIndustrialImport {
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
    const sourceCategory = `EPA GHGRP direct emitter${item.reported_industry_types ? ` · industry codes ${item.reported_industry_types}` : ''}${item.reported_subparts ? ` · subparts ${item.reported_subparts}` : ''}`;
    const record: Partial<Prospect> = {
      name: item.facility_name || 'Unnamed EPA GHGRP facility', facility_type: 'manufacturing', source_category: sourceCategory,
      address: item.address1 ?? null, city: item.city ?? null, state: item.state ?? 'PA', postal_code: item.zip ?? null,
      latitude: Number(item.latitude), longitude: Number(item.longitude), epa_frs_id: frsId || null,
      epa_facility_name: item.facility_name ?? null, epa_programs: ['E-GGRT'], epa_ghgrp_match: true,
      epa_match_confidence: 'source record', energy_factor: ENERGY_FACTORS.manufacturing,
      opportunity_score: opportunityScore('manufacturing', null), enrichment_status: 'pending', prospect_status: 'new',
      public_records_verified_at: new Date().toISOString(),
      notes: item.parent_company ? `Reported parent company: ${item.parent_company}` : null,
    };
    add(key, record, 'ghgrp', {
      facility_id: item.facility_id, eggrt_facility_id: item.eggrt_facility_id, facility_types: item.facility_types,
      reported_industry_types: item.reported_industry_types, reported_subparts: item.reported_subparts,
      parent_company: item.parent_company,
    });
  }

  const activeTri = tri.filter((item) => item.fac_closed_ind !== '1' && usableCoordinate(item.pref_latitude, item.pref_longitude));
  for (const item of activeTri) {
    const frsId = String(item.epa_registry_id ?? '').trim();
    const triId = String(item.tri_facility_id ?? '').trim();
    if (!triId) continue;
    const key = frsId ? `frs:${frsId}` : `tri:${triId}`;
    const record: Partial<Prospect> = {
      name: item.facility_name || 'Unnamed EPA TRI facility', facility_type: 'manufacturing', source_category: 'EPA TRI active industrial facility',
      address: item.street_address ?? null, city: item.city_name ?? null, state: item.state_abbr ?? 'PA', postal_code: item.zip_code ?? null,
      latitude: Number(item.pref_latitude), longitude: Number(item.pref_longitude), phone: item.asgn_public_phone ?? null,
      epa_frs_id: frsId || null, epa_facility_name: item.facility_name ?? null, epa_programs: ['TRI'],
      epa_match_confidence: 'source record', energy_factor: ENERGY_FACTORS.manufacturing,
      opportunity_score: opportunityScore('manufacturing', null), enrichment_status: 'pending', prospect_status: 'new',
      public_records_verified_at: new Date().toISOString(),
      notes: item.parent_co_name && item.parent_co_name !== 'NA' ? `Reported parent company: ${item.parent_co_name}` : null,
    };
    add(key, record, 'tri', {
      tri_facility_id: item.tri_facility_id, epa_registry_id: item.epa_registry_id,
      parent_co_name: item.parent_co_name, fac_closed_ind: item.fac_closed_ind,
    });
  }

  const rows = [...bySite.values()].map((row) => {
    const evidence = { facilityType: row.facility_type, epaFrsId: row.epa_frs_id, epaGhgrpMatch: row.epa_ghgrp_match };
    return { ...row, evidence_score: evidenceScore(evidence), evidence_tier: evidenceTier(evidence) };
  });
  return { rows, sourceCounts: { ghgrp: directEmitters.length, tri: activeTri.length } };
}

export async function fetchPennsylvaniaPublicIndustrialRecords(): Promise<PublicIndustrialImport> {
  const [ghgrpResponse, triResponse] = await Promise.all([timeoutFetch(ghgrpUrl), timeoutFetch(triUrl)]);
  if (!ghgrpResponse.ok || !triResponse.ok) throw new Error('EPA public facility data is temporarily unavailable.');
  const [ghgrp, tri] = await Promise.all([
    ghgrpResponse.json() as Promise<GhgrpFacility[]>,
    triResponse.json() as Promise<TriFacility[]>,
  ]);
  return normalizePublicIndustrialRecords(Array.isArray(ghgrp) ? ghgrp : [], Array.isArray(tri) ? tri : []);
}
