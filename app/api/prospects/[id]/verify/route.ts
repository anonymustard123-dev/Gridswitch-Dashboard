import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase';
import { evidenceScore, evidenceTier } from '@/lib/evidence';
import { verifyPublicRecords } from '@/lib/providers/public-records';

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Public-record verification is unavailable until Supabase is configured.' }, { status: 503 });
  const { id } = await params;
  const { data: prospect, error } = await db.from('prospects').select('*').eq('id', id).single();
  if (error || !prospect) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  try {
    const verified = await verifyPublicRecords(prospect);
    const evidence = { facilityType: prospect.facility_type, epaFrsId: verified.epa_frs_id, epaGhgrpMatch: verified.epa_ghgrp_match, paDepFacilityId: verified.pa_dep_facility_id, buildingFootprintSqft: prospect.building_footprint_sqft };
    const update = { epa_frs_id: verified.epa_frs_id, epa_facility_name: verified.epa_facility_name, epa_programs: verified.epa_programs, epa_ghgrp_match: verified.epa_ghgrp_match, epa_match_confidence: verified.epa_match_confidence, pa_dep_facility_id: verified.pa_dep_facility_id, pa_dep_facility_name: verified.pa_dep_facility_name, pa_dep_facility_type: verified.pa_dep_facility_type, pa_dep_match_confidence: verified.pa_dep_match_confidence, public_records_verified_at: new Date().toISOString(), evidence_score: evidenceScore(evidence), evidence_tier: evidenceTier(evidence), public_records_raw: verified.raw };
    const { data, error: updateError } = await db.from('prospects').update(update).eq('id', id).select('*').single();
    if (updateError) throw updateError;
    return NextResponse.json({ prospect: data });
  } catch (cause) {
    console.error('Public-record verification failed', cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: 'Public-record verification could not be completed. Please try again.' }, { status: 502 });
  }
}
