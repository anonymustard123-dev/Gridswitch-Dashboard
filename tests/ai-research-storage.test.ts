import { describe, expect, it } from 'vitest';
import { embedAiResearch, hydrateEmbeddedAiResearch } from '@/lib/ai-research-storage';
import type { AiFacilityResearch, Prospect } from '@/lib/types';

const research: AiFacilityResearch = {
  facility_summary: 'A documented manufacturing facility.',
  grid_switch_fit: 'moderate',
  fit_reasons: ['Continuous process'],
  qualification: {
    load_intensity: { rating: 'possible', evidence: 'Continuous production is documented.', source_url: 'https://example.com/facility' },
    uptime_criticality: { rating: 'unknown', evidence: 'No public evidence.', source_url: null },
    resilience_need: { rating: 'unknown', evidence: 'No public evidence.', source_url: null },
    expansion_or_capex: { rating: 'unknown', evidence: 'No public evidence.', source_url: null },
    onsite_energy_assets: { rating: 'unknown', evidence: 'No public evidence.', source_url: null },
  },
  operating_evidence: [],
  recommended_action: 'research_more',
  recommended_action_reason: 'Confirm load and outage exposure.',
  outreach_angle: 'Ask about continuity requirements.',
  target_roles: ['Facilities director'],
  discovery_questions: ['What is the peak load?'],
  disqualifiers: ['Minimal site load'],
  unknowns: ['Interval load'],
  sources: [{ title: 'Facility', url: 'https://example.com/facility' }],
};

describe('AI research fallback storage', () => {
  it('hydrates embedded research when dedicated database columns are unavailable', () => {
    const prospect = {
      id: 'p', provider: 'dataforseo', name: 'Facility', facility_type: 'manufacturing',
      enrichment_status: 'pending', prospect_status: 'new',
      dataforseo_raw: embedAiResearch({ provider_record: true }, {
        status: 'complete', research, researched_at: '2026-08-18T00:00:00Z', model: 'gpt-5.4-mini', error: null,
      }),
    } as Prospect;

    const hydrated = hydrateEmbeddedAiResearch(prospect);
    expect(hydrated.ai_research_status).toBe('complete');
    expect(hydrated.ai_research?.grid_switch_fit).toBe('moderate');
    expect((hydrated.dataforseo_raw as Record<string, unknown>).provider_record).toBe(true);
  });
});
