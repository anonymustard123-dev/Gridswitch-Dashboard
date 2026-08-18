import { describe, expect, it } from 'vitest';
import { normalizeRegridResult } from '@/lib/providers/regrid';
describe('Regrid empty responses',()=>{it('does not put a GeoJSON collection into zoning when no parcel matched',()=>{const record=normalizeRegridResult({parcels:{type:'FeatureCollection',features:[]},zoning:{type:'FeatureCollection',features:[]}});expect(record.zoning).toBeNull();expect(record.parcel_id).toBeNull();expect(record.match_confidence).toBeNull();});});
