import { NextResponse } from 'next/server';
import { z } from 'zod';
import { adminDb } from '@/lib/supabase';
import { evidenceScore, evidenceTier } from '@/lib/evidence';
import { verifyPublicRecords } from '@/lib/providers/public-records';

const input = z.object({ ids: z.array(z.string().uuid()).min(1).max(25) });
const pause = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));
const migrationMessage = 'Public-record fields are not available yet. Run supabase/migrations/202608180001_add_public_evidence.sql in the Supabase SQL Editor, then try again.';

export async function POST(request: Request) {
  const parsed = input.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: 'Choose between 1 and 25 valid prospects.' }, { status: 400 });
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Public-record verification is unavailable until Supabase is configured.' }, { status: 503 });
  let completed = 0; let failed = 0; const errors: string[] = [];
  for (const id of parsed.data.ids) {
    try {
      const { data: prospect, error } = await db.from('prospects').select('*').eq('id', id).single();
      if (error || !prospect) throw new Error('Prospect was not found.');
      const verified = await verifyPublicRecords(prospect);
      const evidence = { facilityType: prospect.facility_type, epaFrsId: verified.epa_frs_id, epaGhgrpMatch: verified.epa_ghgrp_match, paDepFacilityId: verified.pa_dep_facility_id, buildingFootprintSqft: prospect.building_footprint_sqft };
      const update = { epa_frs_id: verified.epa_frs_id, epa_facility_name: verified.epa_facility_name, epa_programs: verified.epa_programs, epa_ghgrp_match: verified.epa_ghgrp_match, epa_match_confidence: verified.epa_match_confidence, pa_dep_facility_id: verified.pa_dep_facility_id, pa_dep_facility_name: verified.pa_dep_facility_name, pa_dep_facility_type: verified.pa_dep_facility_type, pa_dep_match_confidence: verified.pa_dep_match_confidence, public_records_raw: verified.raw, public_records_verified_at: new Date().toISOString(), evidence_score: evidenceScore(evidence), evidence_tier: evidenceTier(evidence) };
      const { error: updateError } = await db.from('prospects').update(update).eq('id', id);
      if (updateError) throw updateError;
      completed++;
    } catch (cause) {
      failed++;
      const message = cause instanceof Error ? cause.message : 'Verification failed.';
      errors.push(/column|schema cache|epa_frs_id|evidence_score/i.test(message) ? migrationMessage : message);
    }
    await pause(200);
  }
  return NextResponse.json({ completed, failed, errors });
}
