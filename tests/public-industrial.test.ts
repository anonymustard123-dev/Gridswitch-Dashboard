import { describe, expect, it } from 'vitest';
import { normalizePublicIndustrialRecords } from '@/lib/providers/public-industrial';

describe('public industrial pipeline', () => {
  it('merges GHGRP and TRI records for the same EPA physical site', () => {
    const result = normalizePublicIndustrialRecords([
      {
        facility_id: 1, facility_name: 'Example Glass', address1: '1 Plant Way', city: 'Erie', state: 'PA', zip: '16501',
        latitude: 42.1, longitude: -80.1, frs_id: '1100001', facility_types: 'Direct Emitter', naics_code: '322110', reported_industry_types: 'C,N', reported_subparts: 'C,N', parent_company: 'Example Holdings',
      },
    ], [
      {
        tri_facility_id: 'PATRI001', facility_name: 'Example Glass', street_address: '1 Plant Way', city_name: 'Erie', state_abbr: 'PA', zip_code: '16501',
        pref_latitude: 42.1, pref_longitude: -80.1, epa_registry_id: '1100001', fac_closed_ind: '0', primary_naics_code: '322110', industry_sector: 'Paper manufacturing',
      },
    ]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0]).toMatchObject({ provider: 'public_pipeline', provider_place_id: 'frs:1100001', epa_ghgrp_match: true });
    expect(result.rows[0].epa_programs).toEqual(expect.arrayContaining(['E-GGRT', 'TRI']));
    expect(result.rows[0].source_category).toContain('EPA GHGRP direct emitter');
    expect(result.rows[0].source_category).toContain('EPA TRI active industrial facility');
    expect(result.rows[0].longitude).toBe(-80.1);
    expect(result.rows[0].facility_type).toBe('manufacturing');
    expect((result.rows[0].public_records_raw as { tri: { primary_naics_code: string } }).tri.primary_naics_code).toBe('322110');
  });

  it('uses TRI NAICS data to classify a TRI-only physical facility', () => {
    const result = normalizePublicIndustrialRecords([], [{
      tri_facility_id: 'PATRI002', facility_name: 'Food Plant', street_address: '2 Plant Way', city_name: 'York', state_abbr: 'PA', zip_code: '17401',
      pref_latitude: 39.9, pref_longitude: 76.7, fac_closed_ind: '0', primary_naics_code: '311611', industry_sector: 'Animal food manufacturing',
    }]);
    expect(result.rows[0]).toMatchObject({ facility_type: 'food_processing' });
    expect((result.rows[0].public_records_raw as { tri: { primary_naics_code: string } }).tri.primary_naics_code).toBe('311611');
  });

  it('excludes electricity-generation and closed TRI records from the industrial lead pipeline', () => {
    const result = normalizePublicIndustrialRecords([
      { facility_id: 2, facility_name: 'Power Plant', latitude: 40, longitude: -76, facility_types: 'Direct Emitter', reported_industry_types: 'D' },
    ], [
      { tri_facility_id: 'CLOSED', facility_name: 'Closed Plant', pref_latitude: 40, pref_longitude: -76, fac_closed_ind: '1' },
    ]);
    expect(result.rows).toHaveLength(0);
  });
});
