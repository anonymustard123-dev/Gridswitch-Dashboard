import {describe,it,expect} from 'vitest';
import {GET} from '@/app/api/prospects/route';
describe('prospects API',()=>{it('returns deterministic demo records when no database is configured',async()=>{const response=await GET();const body=await response.json();expect(body.demo).toBe(true);expect(body.prospects).toHaveLength(35);});});
