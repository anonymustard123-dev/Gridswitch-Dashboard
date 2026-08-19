import type { Prospect } from '@/lib/types';

export type MicrogridFit = 'exceptional' | 'strong' | 'qualified' | 'developing' | 'discovery';

export interface MicrogridProfile {
  score: number;
  fit: MicrogridFit;
  processLabel: string;
  processPoints: number;
  operatingPoints: number;
  scalePoints: number;
  evidencePoints: number;
  corporatePoints: number;
  processDetail: string;
  operatingDetail: string;
  scaleDetail: string;
  evidenceDetail: string;
  corporateDetail: string;
  reasons: string[];
}

export type ScoreWeights = {
  process: number;
  operating: number;
  scale: number;
  evidence: number;
  corporate: number;
};

export const DEFAULT_SCORE_WEIGHTS: ScoreWeights = {
  process: 30,
  operating: 34,
  scale: 15,
  evidence: 10,
  corporate: 11,
};

type PublicRaw = {
  ghgrp?: {
    naics_code?: string | null;
    reported_subparts?: string | null;
    parent_company?: string | null;
    facility_types?: string | null;
  };
  tri?: { parent_co_name?: string | null };
};

type IndustryProfile = { label: string; points: number; facilityType: string };

// Editable GridSwitch view of process intensity. These are qualification
// signals, not electricity-use estimates or a statement of customer load.
const NAICS_PROFILES: Array<[RegExp, IndustryProfile]> = [
  [/^322/, { label: 'Paper & paper-product manufacturing', points: 30, facilityType: 'manufacturing' }],
  [/^325/, { label: 'Chemical manufacturing', points: 30, facilityType: 'manufacturing' }],
  [/^324/, { label: 'Petroleum & coal products manufacturing', points: 30, facilityType: 'manufacturing' }],
  [/^331/, { label: 'Primary metal manufacturing', points: 28, facilityType: 'manufacturing' }],
  [/^327/, { label: 'Glass, cement & mineral products manufacturing', points: 27, facilityType: 'manufacturing' }],
  [/^311/, { label: 'Food manufacturing', points: 26, facilityType: 'food_processing' }],
  [/^326/, { label: 'Plastics & rubber products manufacturing', points: 24, facilityType: 'manufacturing' }],
  [/^312/, { label: 'Beverage & tobacco manufacturing', points: 21, facilityType: 'food_processing' }],
  [/^321/, { label: 'Wood products manufacturing', points: 20, facilityType: 'manufacturing' }],
  [/^332/, { label: 'Fabricated metal manufacturing', points: 19, facilityType: 'manufacturing' }],
  [/^333|^334|^336/, { label: 'Industrial manufacturing', points: 17, facilityType: 'manufacturing' }],
  [/^493/, { label: 'Warehousing & distribution', points: 12, facilityType: 'distribution_center' }],
];

const TYPE_PROFILES: Record<string, IndustryProfile> = {
  data_center: { label: 'Data center', points: 30, facilityType: 'data_center' },
  cold_storage: { label: 'Cold storage', points: 28, facilityType: 'cold_storage' },
  food_processing: { label: 'Food processing', points: 26, facilityType: 'food_processing' },
  manufacturing: { label: 'Manufacturing', points: 18, facilityType: 'manufacturing' },
  hospital: { label: 'Hospital / medical campus', points: 20, facilityType: 'hospital' },
  university: { label: 'University campus', points: 16, facilityType: 'university' },
  distribution_center: { label: 'Distribution center', points: 13, facilityType: 'distribution_center' },
  warehouse: { label: 'Warehouse', points: 9, facilityType: 'warehouse' },
};

export function industryProfile(naics?: string | null, facilityType?: string | null): IndustryProfile {
  const normalizedNaics = String(naics ?? '').replace(/\D/g, '');
  return NAICS_PROFILES.find(([pattern]) => pattern.test(normalizedNaics))?.[1]
    ?? TYPE_PROFILES[facilityType ?? '']
    ?? { label: 'Industrial operation', points: 8, facilityType: 'industrial' };
}

export function facilityTypeForNaics(naics?: string | null): string {
  return industryProfile(naics).facilityType;
}

function numberOrZero(value: unknown) {
  const result = Number(value);
  return Number.isFinite(result) && result > 0 ? result : 0;
}

const scaled = (value: number, baseMax: number, weight: number) => Math.round((value / baseMax) * weight);

export function microgridProfile(prospect: Prospect, weights: ScoreWeights = DEFAULT_SCORE_WEIGHTS): MicrogridProfile {
  const raw = (prospect.public_records_raw ?? {}) as PublicRaw;
  const ghgrp = raw.ghgrp;
  const tri = raw.tri;
  const profile = industryProfile(ghgrp?.naics_code, prospect.facility_type);
  const isGhgrp = Boolean(prospect.epa_ghgrp_match || ghgrp?.facility_types === 'Direct Emitter');
  const isTri = Boolean(prospect.epa_programs?.includes('TRI') || tri);
  const hasFrs = Boolean(prospect.epa_frs_id);
  const hasDep = Boolean(prospect.pa_dep_facility_id);
  const subparts = String(ghgrp?.reported_subparts ?? '').split(',').map((part) => part.trim()).filter(Boolean);
  const processSubparts = subparts.filter((part) => ['AA', 'C', 'F', 'G', 'H', 'N', 'P', 'Q', 'S'].includes(part));
  const baseProcessPoints = profile.points;
  const baseOperatingPoints = isGhgrp ? 34 : isTri ? 23 : hasFrs || hasDep ? 14 : 0;
  const buildingArea = numberOrZero(prospect.building_sqft);
  const baseScalePoints = Math.min(15, (processSubparts.length ? 5 : 0) + (buildingArea >= 500_000 ? 10 : buildingArea >= 100_000 ? 6 : 0));
  const baseEvidencePoints = (hasFrs ? 5 : 0) + (hasDep ? 3 : 0) + (isTri ? 2 : 0);
  const parentName = String(ghgrp?.parent_company || tri?.parent_co_name || '').trim();
  const hasParent = Boolean(parentName && !['NA', 'N/A', 'NONE', 'UNKNOWN'].includes(parentName.toUpperCase()))
    || Boolean(prospect.notes?.match(/reported parent company/i));
  // A named parent is not proof of budget approval, but it is a materially
  // better commercial starting point than an unowned directory listing.
  const baseCorporatePoints = hasParent ? 11 : prospect.website || prospect.phone ? 5 : 0;
  const processPoints = scaled(baseProcessPoints, 30, weights.process);
  const operatingPoints = scaled(baseOperatingPoints, 34, weights.operating);
  const scalePoints = scaled(baseScalePoints, 15, weights.scale);
  const evidencePoints = scaled(baseEvidencePoints, 10, weights.evidence);
  const corporatePoints = scaled(baseCorporatePoints, 11, weights.corporate);
  const totalWeight = Object.values(weights).reduce((total, weight) => total + weight, 0) || 1;
  const score = Math.min(100, Math.round(((processPoints + operatingPoints + scalePoints + evidencePoints + corporatePoints) / totalWeight) * 100));
  const fit: MicrogridFit = score >= 75 ? 'exceptional' : score >= 60 ? 'strong' : score >= 45 ? 'qualified' : score >= 28 ? 'developing' : 'discovery';
  const reasons = [
    `${profile.label}${ghgrp?.naics_code ? ` (NAICS ${ghgrp.naics_code})` : ''}`,
    isGhgrp ? 'EPA GHGRP direct-emitter record' : isTri ? 'EPA TRI active industrial record' : hasFrs || hasDep ? 'EPA / PA DEP operating-site record' : null,
    processSubparts.length ? `GHGRP reporting subparts: ${processSubparts.join(', ')}` : null,
    numberOrZero(prospect.building_sqft) >= 100_000 ? `Known building area: ${Math.round(numberOrZero(prospect.building_sqft)).toLocaleString()} sq ft` : null,
    hasParent ? 'Reported parent company available' : null,
  ].filter((reason): reason is string => Boolean(reason));

  const processDetail = `${profile.label}${ghgrp?.naics_code ? ` (NAICS ${ghgrp.naics_code})` : ''}`;
  const operatingDetail = isGhgrp ? 'EPA GHGRP direct-emitter record' : isTri ? 'EPA TRI industrial-facility record' : hasFrs || hasDep ? 'EPA / PA DEP operating-site record' : 'No public operating record found yet';
  const scaleDetail = buildingArea >= 100_000
    ? `${Math.round(buildingArea).toLocaleString()} sq ft known building area${processSubparts.length ? ` + GHGRP subparts ${processSubparts.join(', ')}` : ''}`
    : processSubparts.length ? `GHGRP reporting subparts: ${processSubparts.join(', ')}` : 'No building-area data available';
  const evidenceDetail = [hasFrs ? 'EPA Registry match' : null, hasDep ? 'PA DEP match' : null, isTri ? 'TRI record' : null].filter(Boolean).join(' + ') || 'No exact public-record match yet';
  const corporateDetail = hasParent ? 'Reported parent company available' : prospect.website || prospect.phone ? 'Direct facility contact available' : 'No parent company or direct contact found';

  return { score, fit, processLabel: profile.label, processPoints, operatingPoints, scalePoints, evidencePoints, corporatePoints, processDetail, operatingDetail, scaleDetail, evidenceDetail, corporateDetail, reasons };
}

export const microgridFitLabels: Record<MicrogridFit, string> = {
  exceptional: 'Call now',
  strong: 'High potential',
  qualified: 'Industrial target',
  developing: 'Developing lead',
  discovery: 'Discovery',
};
