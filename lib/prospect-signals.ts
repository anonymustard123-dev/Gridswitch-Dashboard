import { microgridProfile, type ScoreWeights } from '@/lib/microgrid-profile';
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

/**
 * This is a prioritization model, not an electricity-use estimate. It ranks
 * facilities on observable operating-site evidence, so a generic directory
 * listing cannot outrank a corroborated industrial facility.
 */
export function prospectSignals(prospect: Prospect, weights?: ScoreWeights): ProspectSignals {
  const profile = microgridProfile(prospect, weights);
  const epaMatch = Boolean(prospect.epa_frs_id);
  const depMatch = Boolean(prospect.pa_dep_facility_id);
  const ghgrp = Boolean(prospect.epa_ghgrp_match);
  const triMatch = Boolean(prospect.epa_programs?.includes('TRI'));
  const hasPublicEvidence = epaMatch || depMatch;
  const publicRecordsChecked = Boolean(prospect.public_records_verified_at);
  // TRI confirms an operating industrial facility. It does not, by itself,
  // prove a large load, so keep it distinct from GHGRP direct emitters.
  const directoryCategorySignal = prospect.provider === 'dataforseo' && profile.processPoints >= 18;
  const categorySignal = directoryCategorySignal || (ghgrp && profile.processPoints >= 18);

  const evidenceFacts = [
    categorySignal
      ? `${profile.processLabel} — a high process-intensity category`
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

  const score = profile.score;
  const tier: ProspectSignalTier =
    profile.fit === 'exceptional'
      ? 'top_priority'
      : profile.fit === 'strong'
        ? 'priority_site'
        : profile.fit === 'qualified' || (profile.fit === 'developing' && (triMatch || depMatch))
          ? 'industrial_lead'
          : directoryCategorySignal
          ? 'category_lead'
          : 'potential_site';

  const summary =
    tier === 'top_priority'
      ? `Strong industrial prospect: ${profile.processLabel} with high-confidence EPA operating evidence.`
      : tier === 'priority_site'
        ? `High-potential industrial site: ${profile.processLabel} with documented EPA operating evidence.`
        : tier === 'industrial_lead'
          ? triMatch
            ? `EPA TRI confirms an active industrial facility. Its ${profile.processLabel.toLowerCase()} profile warrants load and resilience qualification.`
            : `A public operating-site record confirms the facility; ${profile.processLabel.toLowerCase()} is a useful process-intensity signal.`
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
  top_priority: 'Call now',
  priority_site: 'High potential',
  industrial_lead: 'Industrial lead',
  category_lead: 'Category lead',
  potential_site: 'Directory lead',
};
