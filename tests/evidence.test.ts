import { describe, expect, it } from 'vitest';
import { evidenceScore, evidenceTier } from '@/lib/evidence';

describe('evidence tiers', () => {
  it('keeps a discovery listing separate from verified public records', () => {
    expect(evidenceScore({ facilityType: 'manufacturing' })).toBe(20);
    expect(evidenceTier({ facilityType: 'manufacturing' })).toBe('site_signal');
  });

  it('promotes independent public-record signals without inferring electricity use', () => {
    const signals = { facilityType: 'manufacturing', epaFrsId: '110001', paDepFacilityId: '2002', epaGhgrpMatch: true, buildingFootprintSqft: 100_000 };
    expect(evidenceScore(signals)).toBe(100);
    expect(evidenceTier(signals)).toBe('high_evidence');
  });
});
