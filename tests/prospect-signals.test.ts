import { describe, expect, it } from 'vitest';
import { prospectSignals } from '@/lib/prospect-signals';

describe('DataForSEO prospect signals', () => {
  it('treats manufacturing as a priority category without claiming qualification', () => {
    const signals = prospectSignals({ id: 'p', provider: 'dataforseo', name: 'Example', facility_type: 'manufacturing', source_category: 'Manufacturer', phone: '555', website: 'https://example.com', enrichment_status: 'pending', prospect_status: 'new', dataforseo_raw: { additional_categories: ['Warehouse'], people_also_search: [{}, {}], place_topics: { trucks: 4, 'live load': 3 }, work_time: { work_hours: { timetable: { monday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], tuesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], wednesday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], thursday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }], friday: [{ open: { hour: 0, minute: 0 }, close: { hour: 24, minute: 0 } }] } } } } });
    expect(signals.tier).toBe('priority_category');
    expect(signals.relevanceReasons).toContain('Manufacturing is a higher-load-intensity facility category');
    expect(signals.directoryFacts).toContain('Business profile lists 24/7 hours');
  });

  it('does not turn a 24/7 warehouse or truck lot into a high-priority prospect', () => {
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

    expect(signals.tier).toBe('possible_fit');
    expect(signals.score).toBeLessThan(50);
    expect(signals.relevanceReasons).toContain('Listed 24/7; uptime and outage exposure may matter');
  });

  it('ignores null timetable entries instead of crashing the dashboard', () => {
    const signals = prospectSignals({
      id: 'p-null-hours',
      provider: 'dataforseo',
      name: 'Null Hours Facility',
      facility_type: 'warehouse',
      enrichment_status: 'pending',
      prospect_status: 'new',
      dataforseo_raw: {
        work_time: {
          work_hours: {
            timetable: {
              monday: [null],
              tuesday: [{ open: { hour: 8, minute: 0 }, close: { hour: 17, minute: 0 } }],
            },
          },
        },
      },
    });

    expect(signals.is24Hour).toBe(false);
    expect(signals.directoryFacts).not.toContain('Business profile lists 24/7 hours');
  });
});
