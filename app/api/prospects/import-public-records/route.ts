import { NextResponse } from 'next/server';
import { fetchPennsylvaniaPublicIndustrialRecords } from '@/lib/providers/public-industrial';
import { adminDb } from '@/lib/supabase';

export const maxDuration = 60;

export async function POST() {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Connect Supabase to build the public-record pipeline.' }, { status: 400 });
  try {
    const imported = await fetchPennsylvaniaPublicIndustrialRecords();
    let completed = 0;
    const failed: string[] = [];
    for (let index = 0; index < imported.rows.length; index += 100) {
      const batch = imported.rows.slice(index, index + 100);
      const { error } = await db.from('prospects').upsert(batch, { onConflict: 'provider,provider_place_id' });
      if (error) {
        failed.push(error.message);
      } else {
        completed += batch.length;
      }
    }
    if (!completed && failed.length) throw new Error(failed[0]);
    return NextResponse.json({ imported: completed, failed: failed.length, sourceCounts: imported.sourceCounts });
  } catch (cause) {
    console.error('Public industrial import failed', cause instanceof Error ? cause.message : cause);
    return NextResponse.json({ error: 'Unable to refresh the EPA public-facility records. Please try again.' }, { status: 502 });
  }
}
