import { NextResponse } from 'next/server';
import { fetchPennsylvaniaPublicIndustrialRecords } from '@/lib/providers/public-industrial';
import { adminDb } from '@/lib/supabase';

export const maxDuration = 60;

export async function POST() {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Connect Supabase to build the public-record pipeline.' }, { status: 400 });
  try {
    const imported = await fetchPennsylvaniaPublicIndustrialRecords();
    const { error } = await db.from('prospects').upsert(imported.rows, { onConflict: 'provider,provider_place_id' });
    if (error) throw error;
    return NextResponse.json({ imported: imported.rows.length, sourceCounts: imported.sourceCounts });
  } catch (cause) {
    console.error('Public industrial import failed', cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: 'Unable to refresh the EPA public-facility records. Please try again.' }, { status: 502 });
  }
}
