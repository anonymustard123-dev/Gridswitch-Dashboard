import { ENERGY_FACTORS } from '@/lib/scoring';
import type { Prospect } from '@/lib/types';

export type ProspectSignalTier = 'top_priority' | 'priority_site' | 'screening';

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
  const hasPublicEvidence = epaMatch || depMatch;
  const publicRecordsChecked = Boolean(prospect.public_records_verified_at);

  const evidenceFacts = [
    prioritySector
      ? `${clean(prospect.facility_type || 'industrial')} operation — a high-energy facility category`
      : null,
    ghgrp ? 'EPA Greenhouse Gas Reporting Program facility' : null,
    epaMatch ? 'EPA Facility Registry operating-site match' : null,
    depMatch ? 'Pennsylvania DEP regulated-facility match' : null,
  ].filter((fact): fact is string => Boolean(fact));

  const sourceNames = [
    prioritySector ? 'DataForSEO business category' : null,
    ghgrp ? 'EPA GHGRP' : null,
    epaMatch ? 'EPA FRS match' : publicRecordsChecked ? 'EPA FRS checked' : null,
    depMatch ? 'PA DEP eFACTS match' : publicRecordsChecked ? 'PA DEP eFACTS checked' : null,
  ].filter((source): source is string => Boolean(source));

  const score = Math.min(
    100,
    (prioritySector ? 35 : 0) +
      (epaMatch ? 25 : 0) +
      (depMatch ? 25 : 0) +
      (ghgrp ? 30 : 0),
  );
  const tier: ProspectSignalTier =
    ghgrp || (prioritySector && epaMatch && depMatch)
      ? 'top_priority'
      : prioritySector || (epaMatch && depMatch)
        ? 'priority_site'
        : 'screening';

  const summary =
    tier === 'top_priority'
      ? 'Likely high-energy industrial site based on independent EPA/DEP operating records and facility type.'
      : tier === 'priority_site'
        ? hasPublicEvidence
          ? 'Priority industrial site based on facility type and available operating-site evidence.'
          : publicRecordsChecked
            ? 'Likely high-energy industrial site based on its facility type; EPA and DEP checks found no exact regulatory-site match.'
            : 'Likely high-energy industrial site based on its facility type; public operating-site records are pending.'
        : publicRecordsChecked
          ? 'Potential industrial site; public-source checks found no exact regulatory-site match.'
          : 'Potential industrial site; public operating-site records are pending.';

  return { score, tier, evidenceFacts, sourceNames, summary, hasPublicEvidence, publicRecordsChecked };
}

export const prospectSignalLabels: Record<ProspectSignalTier, string> = {
  top_priority: 'Top priority',
  priority_site: 'Priority site',
  screening: 'Screening',
};
