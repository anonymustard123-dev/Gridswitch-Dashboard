import type { Prospect } from '@/lib/types';

type FrsFacility = { RegistryId?: string; FacilityName?: string; CityName?: string; Latitude83?: string; Longitude83?: string; ProgramFacilities?: { ProgramSystemAcronym?: string; ProgramSystemId?: string; ProgramFacilityName?: string }[] };
type DepFeature = { attributes?: Record<string, unknown> };

const normalize = (value?: string | null) => (value ?? '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
const tokens = (value?: string | null) => new Set(normalize(value).split(' ').filter((token) => token.length > 2));
const similarity = (left?: string | null, right?: string | null) => {
  const a = tokens(left); const b = tokens(right);
  if (!a.size || !b.size) return 0;
  let overlap = 0; a.forEach((token) => { if (b.has(token)) overlap++; });
  return overlap / Math.max(a.size, b.size);
};
const timeout = (url: string) => fetch(url, { signal: AbortSignal.timeout(15_000) });

export interface PublicRecordVerification {
  epa_frs_id: string | null;
  epa_facility_name: string | null;
  epa_programs: string[];
  epa_ghgrp_match: boolean;
  epa_match_confidence: string | null;
  pa_dep_facility_id: string | null;
  pa_dep_facility_name: string | null;
  pa_dep_facility_type: string | null;
  pa_dep_match_confidence: string | null;
  raw: { epa?: unknown; pa_dep?: unknown };
}

function confidence(score: number) { return score >= .8 ? 'high' : score >= .55 ? 'medium' : null; }

export async function verifyPublicRecords(prospect: Prospect): Promise<PublicRecordVerification> {
  const base: PublicRecordVerification = { epa_frs_id: null, epa_facility_name: null, epa_programs: [], epa_ghgrp_match: false, epa_match_confidence: null, pa_dep_facility_id: null, pa_dep_facility_name: null, pa_dep_facility_type: null, pa_dep_match_confidence: null, raw: {} };
  const name = prospect.name?.trim();
  if (!name || !prospect.state?.match(/^PA|Pennsylvania$/i)) return base;

  const epaUrl = new URL('https://ofmpub.epa.gov/frs_public2/frs_rest_services.get_facilities');
  epaUrl.search = new URLSearchParams({ state_abbr: 'PA', facility_name: name, ...(prospect.city ? { city_name: prospect.city } : {}), program_output: 'yes', output: 'JSON' }).toString();
  const depToken = name.split(/\s+/).find((token) => token.length >= 4) ?? name;
  const depUrl = new URL('https://gis.dep.pa.gov/depgisprd/rest/services/emappa/eFactsQueryExternal/MapServer/0/query');
  depUrl.search = new URLSearchParams({ f: 'json', where: `UPPER(PRIMARY_FACILITY_NAME) LIKE '%${depToken.replace(/'/g, "''").toUpperCase()}%'`, outFields: 'PRIMARY_FACILITY_NAME,PRIMARY_FACILITY_ID,PRIMARY_FACILITY_TYPE,PRIMARY_FACILITY_KIND,SITE_NAME,ORGANIZATION_NAME', returnGeometry: 'false', resultRecordCount: '10' }).toString();

  const [epaResult, depResult] = await Promise.allSettled([timeout(epaUrl.toString()), timeout(depUrl.toString())]);
  if (epaResult.status === 'fulfilled' && epaResult.value.ok) {
    const raw = await epaResult.value.json().catch(() => null);
    base.raw.epa = raw;
    const candidates: FrsFacility[] = raw?.Results?.FRSFacility ?? [];
    const best = candidates.map((candidate) => ({ candidate, score: similarity(name, candidate.FacilityName) + (normalize(prospect.city) === normalize(candidate.CityName) ? .2 : 0) })).sort((a, b) => b.score - a.score)[0];
    if (best && confidence(best.score)) {
      base.epa_frs_id = best.candidate.RegistryId ?? null;
      base.epa_facility_name = best.candidate.FacilityName ?? null;
      base.epa_match_confidence = confidence(best.score);
      base.epa_programs = (best.candidate.ProgramFacilities ?? []).map((program) => program.ProgramSystemAcronym).filter((program): program is string => Boolean(program));
      base.epa_ghgrp_match = base.epa_programs.includes('E-GGRT');
    }
  }
  if (depResult.status === 'fulfilled' && depResult.value.ok) {
    const raw = await depResult.value.json().catch(() => null);
    base.raw.pa_dep = raw;
    const candidates: DepFeature[] = raw?.features ?? [];
    const best = candidates.map((feature) => ({ feature, score: Math.max(similarity(name, String(feature.attributes?.PRIMARY_FACILITY_NAME ?? '')), similarity(name, String(feature.attributes?.SITE_NAME ?? '')), similarity(name, String(feature.attributes?.ORGANIZATION_NAME ?? ''))) })).sort((a, b) => b.score - a.score)[0];
    if (best && confidence(best.score)) {
      const fields = best.feature.attributes ?? {};
      base.pa_dep_facility_id = String(fields.PRIMARY_FACILITY_ID ?? '') || null;
      base.pa_dep_facility_name = String(fields.PRIMARY_FACILITY_NAME ?? fields.SITE_NAME ?? '') || null;
      base.pa_dep_facility_type = String(fields.PRIMARY_FACILITY_TYPE ?? fields.PRIMARY_FACILITY_KIND ?? '') || null;
      base.pa_dep_match_confidence = confidence(best.score);
    }
  }
  return base;
}
