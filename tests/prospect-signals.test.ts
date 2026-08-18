import { describe, expect, it } from 'vitest';
import { prospectSignals } from '@/lib/prospect-signals';

describe('DataForSEO prospect signals', () => {
  it('treats manufacturing as a priority industrial site without overstating the directory data', () => {
    const signals = prospectSignals({ id: 'p', provider: 'dataforseo', name: 'Example', facility_type: 'manufacturing', source_category: 'Manufacturer', phone: '555', website: 'https://example.com', enrichment_status: 'pending', prospect_status: 'new', dataforseo_raw: { additional_categories: ['Warehouse'], people_also_search: [{}, {}], place_topics: { trucks: 4, 'live load': 3 }, work_time: { work_hours: { timetable: { monday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], tuesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], wednesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], thursday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], friday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }] } } } } });
    expect(signals.tier).toBe('category_lead');
    expect(signals.evidenceFacts).toContain('Manufacturing operation — a high-energy facility category');
    expect(signals.hasPublicEvidence).toBe(false);
  });

  it('keeps a warehouse without public evidence in the screening list', () => {
    const signals = prospectSignals({
      id: 'warehouse',
      provider: 'dataforseo',
      name: 'Drop Lot',
      facility_type: 'warehouse',
      enrichment_status: 'pending',
      prospect_status: 'new',
      dataforseo_raw: {
        place_topics: { trucks: 4, 'drop and hook': 2 },
        work_time: { work_hours: { timetable: {
          monday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }],
          tuesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }],
          wednesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }],
          thursday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }],
          friday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }],
        } } },
      },
    });

    expect(signals.tier).toBe('potential_site');
    expect(signals.score).toBeLessThan(50);
    expect(signals.hasPublicEvidence).toBe(false);
  });

  it('promotes a corroborated industrial facility to the top priority tier', () => {
    const signals = prospectSignals({
      id: 'p-null-hours',
      provider: 'dataforseo',
      name: 'Verified Plant',
      facility_type: 'manufacturing',
      enrichment_status: 'pending',
      prospect_status: 'new',
      epa_frs_id: '110001',
      pa_dep_facility_id: 'PA-100',
      epa_ghgrp_match: true,
    });

    expect(signals.tier).toBe('top_priority');
    expect(signals.evidenceFacts).toContain('EPA GHGRP direct-emitter facility record');
    expect(signals.hasPublicEvidence).toBe(true);
  });

  it('promotes an EPA-verified operating site even when its directory category is weak', () => {
    const signals = prospectSignals({
      id: 'epa-warehouse', provider: 'dataforseo', name: 'US Nonwovens', facility_type: 'warehouse',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '110070681998',
      epa_facility_name: 'US NONWOVENS, INC.', epa_programs: ['ICIS'],
    });

    expect(signals.tier).toBe('priority_site');
    expect(signals.summary).toContain('Verified operating industrial site');
    expect(signals.hasPublicEvidence).toBe(true);
  });
});
