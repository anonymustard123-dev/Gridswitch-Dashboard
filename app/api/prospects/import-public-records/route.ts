import { NextResponse } from 'next/server';
import { fetchPennsylvaniaPublicIndustrialRecords } from '@/lib/providers/public-industrial';
import { adminDb } from '@/lib/supabase';

// The first full EPA refresh can contain thousands of physical sites. Vercel
// supports a longer serverless route here; this is still a user-triggered,
// synchronous operation rather than a background job.
export const maxDuration = 300;

export async function POST() {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Connect Supabase to build the public-record pipeline.' }, { status: 400 });
  try {
    const imported = await fetchPennsylvaniaPublicIndustrialRecords();
    let completed = 0;
    const failed: string[] = [];
    for (let index = 0; index < imported.rows.length; index += 500) {
      const batch = imported.rows.slice(index, index + 500);
      const { error } = await db.from('prospects').upsert(batch, { onConflict: 'provider,provider_place_id' });
      if (error) {
        // Keep recovery bounded: isolate a bad record without turning a refresh
        // into hundreds of sequential database calls.
        console.error('EPA public-record batch upsert failed', { batchSize: batch.length, message: error.message });
        for (let retryIndex = 0; retryIndex < batch.length; retryIndex += 25) {
          const retryBatch = batch.slice(retryIndex, retryIndex + 25);
          const { error: retryError } = await db.from('prospects').upsert(retryBatch, { onConflict: 'provider,provider_place_id' });
          if (retryError) failed.push(retryError.message);
          else completed += retryBatch.length;
        }
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
