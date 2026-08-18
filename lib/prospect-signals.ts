import { ENERGY_FACTORS } from '@/lib/scoring';
import type { Prospect } from '@/lib/types';

export type ProspectSignalTier = 'top_priority' | 'priority_site' | 'industrial_lead' | 'category_lead' | 'potential_site';

export interface ProspectSignals {
  score: number;
  tier: ProspectSignalTier;
  evidenceFacts: string[];
  sourceNames: string[];
  summary: string;
  hasPublicEvidence: boolean;
  publicRecordsChecked: boolean;
}

const clean = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

/**
 * This is a prioritization model, not an electricity-use estimate. It ranks
 * facilities on observable operating-site evidence, so a generic directory
 * listing cannot outrank a corroborated industrial facility.
 */
export function prospectSignals(prospect: Prospect): ProspectSignals {
  const factor = ENERGY_FACTORS[prospect.facility_type || 'unknown'] ?? ENERGY_FACTORS.unknown;
  const prioritySector = factor >= 7;
  const epaMatch = Boolean(prospect.epa_frs_id);
  const depMatch = Boolean(prospect.pa_dep_facility_id);
  const ghgrp = Boolean(prospect.epa_ghgrp_match);
  const triMatch = Boolean(prospect.epa_programs?.includes('TRI'));
  const hasPublicEvidence = epaMatch || depMatch;
  const publicRecordsChecked = Boolean(prospect.public_records_verified_at);
  // TRI confirms an operating industrial facility. It does not, by itself,
  // prove a large load, so keep it distinct from GHGRP direct emitters.
  const directoryCategorySignal = prospect.provider === 'dataforseo' && prioritySector;
  const categorySignal = directoryCategorySignal || (ghgrp && prioritySector);

  const evidenceFacts = [
    categorySignal
      ? `${clean(prospect.facility_type || 'industrial')} operation — a high-energy facility category`
      : null,
    ghgrp ? 'EPA GHGRP direct-emitter facility record' : null,
    triMatch ? 'EPA TRI active industrial-facility record' : null,
    epaMatch && !ghgrp && !triMatch ? 'EPA Facility Registry operating-site match' : null,
    depMatch ? 'Pennsylvania DEP regulated-facility match' : null,
  ].filter((fact): fact is string => Boolean(fact));

  const sourceNames = [
    directoryCategorySignal ? 'DataForSEO business category' : null,
    ghgrp ? 'EPA GHGRP direct emitter' : null,
    triMatch ? 'EPA TRI active facility' : null,
    epaMatch && !ghgrp && !triMatch ? 'EPA FRS match' : publicRecordsChecked ? 'EPA FRS checked' : null,
    depMatch ? 'PA DEP eFACTS match' : publicRecordsChecked ? 'PA DEP eFACTS checked' : null,
  ].filter((source): source is string => Boolean(source));

  const score = ghgrp
    ? 95
    : triMatch
      ? 65
      : directoryCategorySignal && hasPublicEvidence
        ? 75
        : directoryCategorySignal
          ? 45
          : hasPublicEvidence
            ? 40
            : 10;
  const tier: ProspectSignalTier =
    ghgrp
      ? 'top_priority'
      : triMatch
        ? 'industrial_lead'
        : directoryCategorySignal && hasPublicEvidence
        ? 'priority_site'
        : directoryCategorySignal
          ? 'category_lead'
          : hasPublicEvidence
            ? 'industrial_lead'
          : 'potential_site';

  const summary =
    tier === 'top_priority'
      ? 'EPA GHGRP identifies this as a direct-emitter industrial facility. Start here for high-energy outreach.'
      : tier === 'priority_site'
        ? 'High-energy facility category corroborated by a public operating-site record.'
        : tier === 'industrial_lead'
          ? triMatch
            ? 'EPA TRI confirms an active industrial facility. Validate load, operating schedule, and outage exposure before executive outreach.'
            : 'A public EPA or Pennsylvania DEP record confirms an operating site; energy intensity still needs qualification.'
        : tier === 'category_lead'
          ? publicRecordsChecked
            ? 'High-energy facility category, but no exact EPA or DEP regulatory-site match was found.'
            : 'High-energy facility category; public operating-site checks are in progress.'
          : publicRecordsChecked
            ? 'Potential industrial site; public-source checks found no exact regulatory-site match.'
            : 'Potential industrial site; public operating-site records are pending.';

  return { score, tier, evidenceFacts, sourceNames, summary, hasPublicEvidence, publicRecordsChecked };
}

export const prospectSignalLabels: Record<ProspectSignalTier, string> = {
  top_priority: 'Top priority',
  priority_site: 'Priority site',
  industrial_lead: 'Industrial lead',
  category_lead: 'Category lead',
  potential_site: 'Directory lead',
};
