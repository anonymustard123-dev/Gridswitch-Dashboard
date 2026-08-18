import { describe, expect, it } from 'vitest';
import { prospectSignals } from '@/lib/prospect-signals';

describe('DataForSEO prospect signals', () => {
  it('turns operational listing facts into explainable outreach cues', () => {
    const signals = prospectSignals({ id: 'p', provider: 'dataforseo', name: 'Example', facility_type: 'manufacturing', source_category: 'Manufacturer', phone: '555', website: 'https://example.com', enrichment_status: 'pending', prospect_status: 'new', dataforseo_raw: { additional_categories: ['Warehouse'], people_also_search: [{}, {}], place_topics: { trucks: 4, 'live load': 3 }, work_time: { work_hours: { timetable: { monday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], tuesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], wednesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], thursday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], friday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }] } } } } });
    expect(signals.tier).toBe('strong_operating_signal');
    expect(signals.reasons).toContain('Listed 24/7 hours');
  });
});
