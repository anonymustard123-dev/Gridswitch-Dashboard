import { describe, expect, it } from 'vitest';
import { projectUrlFromDataApiUrl } from '@/lib/supabase';
describe('Supabase Data API configuration',()=>{it('derives a client project root from the Data API URL',()=>expect(projectUrlFromDataApiUrl('https://hrgidimxgomwjsvzernl.supabase.co/rest/v1/')).toBe('https://hrgidimxgomwjsvzernl.supabase.co'));});
