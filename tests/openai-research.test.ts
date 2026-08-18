import { describe, expect, it } from 'vitest';
import { normalizeResearch } from '@/lib/research-qualification';
import type { AiFacilityResearch } from '@/lib/types';

const source = 'https://example.com/facility';

describe('AI microgrid research normalization', () => {
  it('tolerates research saved by the earlier schema', () => {
    const legacy = { facility_summary: 'Legacy result', grid_switch_fit: 'moderate' } as AiFacilityResearch;
    expect(normalizeResearch(legacy)).toEqual(legacy);
  });

  it('does not treat statements that no evidence was found as positive fit evidence', () => {
    const result = normalizeResearch({
      facility_summary: 'A warehouse.',
      grid_switch_fit: 'moderate',
      fit_reasons: ['Open continuously'],
      qualification: {
        load_intensity: { rating: 'possible', evidence: 'No direct evidence of continuous process load was found.', source_url: source },
        uptime_criticality: { rating: 'possible', evidence: 'No site-specific outage requirement is documented.', source_url: source },
        resilience_need: { rating: 'possible', evidence: 'No public evidence of resilience needs.', source_url: source },
        expansion_or_capex: { rating: 'possible', evidence: 'No documented expansion was found.', source_url: source },
        onsite_energy_assets: { rating: 'possible', evidence: 'No public source documents onsite assets.', source_url: source },
      },
      operating_evidence: [],
      recommended_action: 'prioritize_outreach',
      recommended_action_reason: 'Research further.',
      outreach_angle: 'Ask about uptime.',
      target_roles: ['Facility manager'],
      discovery_questions: ['What is the load?'],
      disqualifiers: ['Small load'],
      unknowns: ['Load'],
      sources: [{ title: 'Facility', url: source }],
    } as AiFacilityResearch);

    expect(result.grid_switch_fit).toBe('unknown');
    expect(result.recommended_action).toBe('research_more');
    expect(Object.values(result.qualification).every((signal) => signal.rating === 'unknown')).toBe(true);
  });
});
