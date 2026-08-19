import type { Prospect } from '@/lib/types';

export type MicrogridFit = 'exceptional' | 'strong' | 'qualified' | 'developing' | 'discovery';

export interface MicrogridProfile {
  score: number;
  fit: MicrogridFit;
  processLabel: string;
  processPoints: number;
  operatingPoints: number;
  scalePoints: number;
  outreachPoints: number;
  processDetail: string;
  operatingDetail: string;
  scaleDetail: string;
  outreachDetail: string;
  reasons: string[];
}

export type ScoreWeights = {
  process: number;
  operating: number;
  scale: number;
  outreach: number;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  process: 45,
  operating: 25,
  scale: 20,
  outreach: 10,
};

export const SCORE_METRIC_GUIDES: Record<keyof ScoreWeights, { title: string; description: string; rules: string[] }> = {
  process: {
    title: 'Industry and process fit',
    description: 'What the facility makes or does. Industries with large, continuous, or energy-heavy processes score higher.',
    rules: [
      '45: Paper, chemicals, refining, primary metals, cement, glass, data centers, or cold storage',
      '35–40: Food processing, plastics, rubber, beverage, or other process manufacturing',
      '22–30: Industrial manufacturing, machinery, automotive, wood, or fabricated metals',
      '10–18: Distribution, warehousing, hospitals, universities, or general manufacturing',
      '0–8: No reliable industry classification yet',
    ],
  },
  operating: {
    title: 'Reported operating scale',
    description: 'Public reporting that indicates the size and seriousness of the industrial operation. This is not an electricity-use estimate.',
    rules: [
      '25: GHGRP direct emitter with large reported annual emissions',
      '20–23: GHGRP direct emitter; a facility required to report significant industrial emissions',
      '12–18: TRI reporting facility, with more points when production-related reporting is available',
      '5: EPA FRS or Pennsylvania DEP operating record only',
      '0: No qualifying public operating record',
    ],
  },
  scale: {
    title: 'Physical site evidence',
    description: 'Actual building, footprint, or parcel information. Missing physical data earns zero points—reporting categories do not count.',
    rules: [
      '20: At least 1,000,000 sq ft of verified building or footprint area, or a very large industrial parcel',
      '16: 500,000–999,999 sq ft',
      '12: 250,000–499,999 sq ft',
      '8: 100,000–249,999 sq ft',
      '4: 50,000–99,999 sq ft or a meaningful industrial parcel',
      '0: No reliable physical site data',
    ],
  },
  outreach: {
    title: 'Outreach readiness',
    description: 'Whether there is a clear company or a practical route to contact the site.',
    rules: [
      '10: Named parent company plus both website and phone',
      '8: Named parent company plus either website or phone',
      '5: Named parent company',
      '3: Website or phone available',
      '0: No parent company or direct contact',
    ],
  },
};

type PublicRaw = {
  ghgrp?: {
    naics_code?: string | null;
    reported_subparts?: string | null;
    parent_company?: string | null;
    facility_types?: string | null;
    reported_total_emissions?: number | string | null;
    total_reported_emissions?: number | string | null;
    total_co2e_emissions?: number | string | null;
    latest_reported_emissions?: number | string | null;
    emissions_reporting_year?: number | string | null;
  };
  tri?: {
    parent_co_name?: string | null;
    standardized_parent_company?: string | null;
    primary_naics_code?: string | null;
    naics_code?: string | null;
    industry_sector_code?: string | null;
    industry_sector?: string | null;
    production_ratio_or_activity_index?: number | string | null;
  };
};

type IndustryProfile = { label: string; points: number; facilityType: string };

// Editable GridSwitch process-fit model. These are deterministic screening
// categories, not estimates of a site's electric load or power bill.
const NAICS_PROFILES: Array<[RegExp, IndustryProfile]> = [
  [/^322/, { label: 'Paper & paper-product manufacturing', points: 45, facilityType: 'manufacturing' }],
  [/^325/, { label: 'Chemical manufacturing', points: 45, facilityType: 'manufacturing' }],
  [/^324/, { label: 'Petroleum & coal products manufacturing', points: 45, facilityType: 'manufacturing' }],
  [/^331/, { label: 'Primary metal manufacturing', points: 43, facilityType: 'manufacturing' }],
  [/^327/, { label: 'Glass, cement & mineral products manufacturing', points: 42, facilityType: 'manufacturing' }],
  [/^311/, { label: 'Food manufacturing', points: 39, facilityType: 'food_processing' }],
  [/^326/, { label: 'Plastics & rubber products manufacturing', points: 37, facilityType: 'manufacturing' }],
  [/^312/, { label: 'Beverage & tobacco manufacturing', points: 34, facilityType: 'food_processing' }],
  [/^321/, { label: 'Wood products manufacturing', points: 29, facilityType: 'manufacturing' }],
  [/^332/, { label: 'Fabricated metal manufacturing', points: 28, facilityType: 'manufacturing' }],
  [/^333|^334|^336/, { label: 'Industrial manufacturing', points: 26, facilityType: 'manufacturing' }],
  [/^493/, { label: 'Warehousing & distribution', points: 15, facilityType: 'distribution_center' }],
];

const TYPE_PROFILES: Record<string, IndustryProfile> = {
  data_center: { label: 'Data center', points: 45, facilityType: 'data_center' },
  cold_storage: { label: 'Cold storage', points: 45, facilityType: 'cold_storage' },
  food_processing: { label: 'Food processing', points: 39, facilityType: 'food_processing' },
  manufacturing: { label: 'Manufacturing', points: 22, facilityType: 'manufacturing' },
  hospital: { label: 'Hospital / medical campus', points: 18, facilityType: 'hospital' },
  university: { label: 'University campus', points: 14, facilityType: 'university' },
  distribution_center: { label: 'Distribution center', points: 15, facilityType: 'distribution_center' },
  warehouse: { label: 'Warehouse', points: 10, facilityType: 'warehouse' },
};

const parentFromRaw = (raw: PublicRaw) => String(raw.ghgrp?.parent_company || raw.tri?.standardized_parent_company || raw.tri?.parent_co_name || '').trim();
const usableParent = (value: string) => Boolean(value && !['NA', 'N/A', 'NONE', 'UNKNOWN'].includes(value.toUpperCase()));
const numberOrZero = (value: unknown) => {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
};
const scaled = (value: number, baseMax: number, weight: number) => Math.round((value / baseMax) * weight);

export function industryProfile(naics?: string | null, facilityType?: string | null): IndustryProfile {
  const normalizedNaics = String(naics ?? '').replace(/\D/g, '');
  return NAICS_PROFILES.find(([pattern]) => pattern.test(normalizedNaics))?.[1]
    ?? TYPE_PROFILES[facilityType ?? '']
    ?? { label: 'Industrial operation', points: 8, facilityType: 'industrial' };
}

export function facilityTypeForNaics(naics?: string | null): string {
  return industryProfile(naics).facilityType;
}

export function reportedParentCompany(prospect: Prospect): string | null {
  const parent = parentFromRaw((prospect.public_records_raw ?? {}) as PublicRaw);
  if (usableParent(parent)) return parent;
  const noteMatch = prospect.notes?.match(/reported parent company:\s*(.+)/i)?.[1]?.trim();
  return noteMatch && usableParent(noteMatch) ? noteMatch : null;
}

function ghgrpEmissions(ghgrp: PublicRaw['ghgrp']) {
  return numberOrZero(ghgrp?.latest_reported_emissions) || numberOrZero(ghgrp?.reported_total_emissions) || numberOrZero(ghgrp?.total_reported_emissions) || numberOrZero(ghgrp?.total_co2e_emissions);
}

export function microgridProfile(prospect: Prospect, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): MicrogridProfile {
  const raw = (prospect.public_records_raw ?? {}) as PublicRaw;
  const ghgrp = raw.ghgrp;
  const tri = raw.tri;
  const triNaics = tri?.primary_naics_code || tri?.naics_code || tri?.industry_sector_code;
  const profile = industryProfile(ghgrp?.naics_code || triNaics, prospect.facility_type);
  const isGhgrp = Boolean(prospect.epa_ghgrp_match || ghgrp?.facility_types === 'Direct Emitter');
  const isTri = Boolean(prospect.epa_programs?.includes('TRI') || tri);
  const hasFrsOrDep = Boolean(prospect.epa_frs_id || prospect.pa_dep_facility_id);
  const emissions = ghgrpEmissions(ghgrp);
  const triProduction = numberOrZero(tri?.production_ratio_or_activity_index);
  const baseProcessPoints = profile.points;
  const baseOperatingPoints = isGhgrp
    ? emissions >= 500_000 ? 25 : emissions >= 100_000 ? 23 : 20
    : isTri ? triProduction > 1.15 ? 18 : triProduction > 0 ? 15 : 12
    : hasFrsOrDep ? 5 : 0;
  const buildingArea = Math.max(numberOrZero(prospect.building_sqft), numberOrZero(prospect.building_footprint_sqft));
  const parcelAcres = numberOrZero(prospect.parcel_acres);
  const baseScalePoints = buildingArea >= 1_000_000 || parcelAcres >= 50 ? 20
    : buildingArea >= 500_000 || parcelAcres >= 25 ? 16
    : buildingArea >= 250_000 || parcelAcres >= 15 ? 12
    : buildingArea >= 100_000 || parcelAcres >= 8 ? 8
    : buildingArea >= 50_000 || parcelAcres >= 3 ? 4 : 0;
  const parentName = reportedParentCompany(prospect);
  const contactCount = Number(Boolean(prospect.website)) + Number(Boolean(prospect.phone));
  const baseOutreachPoints = parentName ? 5 + (contactCount === 2 ? 5 : contactCount ? 3 : 0) : contactCount ? 3 : 0;
  const processPoints = scaled(baseProcessPoints, 45, weights.process);
  const operatingPoints = scaled(baseOperatingPoints, 25, weights.operating);
  const scalePoints = scaled(baseScalePoints, 20, weights.scale);
  const outreachPoints = scaled(baseOutreachPoints, 10, weights.outreach);
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0) || 1;
  const score = Math.min(100, Math.round(((processPoints + operatingPoints + scalePoints + outreachPoints) / totalWeight) * 100));
  const fit: MicrogridFit = score >= 75 ? 'exceptional' : score >= 60 ? 'strong' : score >= 45 ? 'qualified' : score >= 28 ? 'developing' : 'discovery';
  const naics = ghgrp?.naics_code || triNaics;
  const operatingDetail = isGhgrp
    ? emissions ? `GHGRP direct emitter; ${Math.round(emissions).toLocaleString()} reported metric tons CO₂e${ghgrp?.emissions_reporting_year ? ` in ${ghgrp.emissions_reporting_year}` : ''}` : 'GHGRP direct-emitter facility record'
    : isTri ? triProduction ? `TRI industrial reporting; production/activity indicator ${triProduction}` : 'TRI industrial-facility record'
    : hasFrsOrDep ? 'EPA FRS or Pennsylvania DEP operating-site record' : 'No qualifying public operating record';
  const scaleDetail = buildingArea
    ? `${Math.round(buildingArea).toLocaleString()} sq ft of known building or footprint area${parcelAcres ? `; ${parcelAcres.toLocaleString()} acres` : ''}`
    : parcelAcres ? `${parcelAcres.toLocaleString()} acre parcel` : 'No reliable building, footprint, or parcel-size data';
  const outreachDetail = parentName
    ? `${parentName}${contactCount === 2 ? ' plus website and phone' : contactCount ? ' plus a direct contact channel' : ''}`
    : contactCount === 2 ? 'Facility website and phone available' : prospect.website ? 'Facility website available' : prospect.phone ? 'Facility phone available' : 'No parent company or direct contact found';
  const reasons = [
    `${profile.label}${naics ? ` (NAICS ${naics})` : ''}`,
    isGhgrp ? 'EPA GHGRP direct-emitter record' : isTri ? 'EPA TRI industrial-facility record' : hasFrsOrDep ? 'EPA / PA DEP operating-site record' : null,
    buildingArea >= 50_000 ? `Known building/footprint area: ${Math.round(buildingArea).toLocaleString()} sq ft` : parcelAcres >= 3 ? `Known industrial parcel: ${parcelAcres} acres` : null,
    parentName ? `Reported parent company: ${parentName}` : null,
  ].filter((reason): reason is string => Boolean(reason));

  return {
    score, fit, processLabel: profile.label, processPoints, operatingPoints, scalePoints, outreachPoints,
    processDetail: `${profile.label}${naics ? ` (NAICS ${naics})` : ''}`,
    operatingDetail, scaleDetail, outreachDetail, reasons,
  };
}

export const microgridFitLabels: Record<MicrogridFit, string> = {
  exceptional: 'Call now',
  strong: 'High potential',
  qualified: 'Industrial target',
  developing: 'Developing lead',
  discovery: 'Discovery',
};
