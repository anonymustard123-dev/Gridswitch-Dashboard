import { describe, expect, it } from 'vitest';
import { prospectSignals } from '@/lib/prospect-signals';

describe('prospect signals', () => {
  it('keeps a manufacturing directory record as a category lead until it has public operating evidence', () => {
    const signals = prospectSignals({
      id: 'directory', provider: 'dataforseo', name: 'Example', facility_type: 'manufacturing',
      enrichment_status: 'pending', prospect_status: 'new', phone: '555',
    });
    expect(signals.tier).toBe('category_lead');
    expect(signals.score).toBeGreaterThanOrEqual(18);
    expect(signals.hasPublicEvidence).toBe(false);
  });

  it('keeps a warehouse without public evidence out of the ranked pipeline', () => {
    const signals = prospectSignals({
      id: 'warehouse', provider: 'dataforseo', name: 'Drop Lot', facility_type: 'warehouse',
      enrichment_status: 'pending', prospect_status: 'new',
    });
    expect(signals.tier).toBe('potential_site');
    expect(signals.score).toBeLessThan(28);
  });

  it('calls a direct emitter with multiple public records a high-potential lead', () => {
    const signals = prospectSignals({
      id: 'direct-emitter', provider: 'public_pipeline', name: 'Verified Plant', facility_type: 'manufacturing',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '110001', pa_dep_facility_id: 'PA-100',
      epa_ghgrp_match: true,
    });
    expect(signals.tier).toBe('priority_site');
    expect(signals.evidenceFacts).toContain('EPA GHGRP direct-emitter facility record');
  });

  it('keeps a generic EPA facility record below the actionable tiers', () => {
    const signals = prospectSignals({
      id: 'epa-warehouse', provider: 'dataforseo', name: 'Warehouse', facility_type: 'warehouse',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '110070681998', epa_programs: ['ICIS'],
    });
    expect(signals.tier).toBe('potential_site');
    expect(signals.summary).toContain('Potential industrial site');
  });

  it('uses TRI as industrial evidence rather than a call-now classification', () => {
    const signals = prospectSignals({
      id: 'tri', provider: 'public_pipeline', name: 'TRI Plant', facility_type: 'manufacturing',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '1100', epa_programs: ['TRI'],
    });
    expect(signals.tier).toBe('industrial_lead');
    expect(signals.evidenceFacts).toContain('EPA TRI active industrial-facility record');
  });
});
