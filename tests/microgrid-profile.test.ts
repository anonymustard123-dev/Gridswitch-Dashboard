import { describe, expect, it } from 'vitest';
import { microgridProfile } from '@/lib/microgrid-profile';

describe('microgrid opportunity profile', () => {
  it('elevates a documented paper-sector direct emitter above a generic TRI facility', () => {
    const paper = microgridProfile({
      id: 'paper', provider: 'public_pipeline', name: 'Paper Mill', facility_type: 'manufacturing',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '1100', epa_ghgrp_match: true,
      public_records_raw: { ghgrp: { naics_code: '322110', reported_subparts: 'AA,C', parent_company: 'Paper Holdings' } },
    });
    const tri = microgridProfile({
      id: 'tri', provider: 'public_pipeline', name: 'Industrial Site', facility_type: 'industrial',
      enrichment_status: 'pending', prospect_status: 'new', epa_frs_id: '1101', epa_programs: ['TRI'],
      public_records_raw: { tri: { parent_co_name: 'NA' } },
    });

    expect(paper.fit).toBe('exceptional');
    expect(paper.processLabel).toBe('Paper & paper-product manufacturing');
    expect(paper.score).toBeGreaterThan(tri.score);
    expect(tri.fit).toBe('developing');
  });

  it('recalculates the score when the user changes category weights', () => {
    const prospect = {
      id: 'weight-test', provider: 'public_pipeline', name: 'Paper Mill', facility_type: 'manufacturing',
      enrichment_status: 'pending' as const, prospect_status: 'new' as const, epa_frs_id: '1100', epa_ghgrp_match: true,
      public_records_raw: { ghgrp: { naics_code: '322110', reported_subparts: 'AA,C' } },
    };
    const defaultProfile = microgridProfile(prospect);
    const operationsFirst = microgridProfile(prospect, { process: 5, operating: 70, scale: 10, evidence: 10, corporate: 5 });

    expect(operationsFirst.score).not.toBe(defaultProfile.score);
    expect(operationsFirst.processPoints).toBe(5);
    expect(operationsFirst.operatingPoints).toBe(70);
  });
});
