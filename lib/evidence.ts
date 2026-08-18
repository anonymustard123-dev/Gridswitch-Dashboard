export type EvidenceTier = 'needs_review' | 'site_signal' | 'priority_outreach' | 'high_evidence';

export interface EvidenceInput {
  facilityType?: string | null;
  epaFrsId?: string | null;
  epaGhgrpMatch?: boolean | null;
  paDepFacilityId?: string | null;
  buildingFootprintSqft?: number | null;
}

/**
 * This is deliberately an evidence count, not an electricity-use estimate.
 * A prospect earns separate points for independent, observable facts.
 */
export function evidenceScore(input: EvidenceInput) {
  let score = input.facilityType && input.facilityType !== 'unknown' ? 20 : 0;
  if (input.epaFrsId) score += 25;
  if (input.paDepFacilityId) score += 25;
  if (input.epaGhgrpMatch) score += 20;
  if ((input.buildingFootprintSqft ?? 0) >= 50_000) score += 10;
  return Math.min(score, 100);
}

export function evidenceTier(input: EvidenceInput): EvidenceTier {
  const score = evidenceScore(input);
  if (score >= 70) return 'high_evidence';
  if (score >= 45) return 'priority_outreach';
  if (score >= 20) return 'site_signal';
  return 'needs_review';
}

export const evidenceTierLabel: Record<EvidenceTier, string> = {
  needs_review: 'Needs review',
  site_signal: 'Site signal',
  priority_outreach: 'Priority outreach',
  high_evidence: 'High evidence',
};
