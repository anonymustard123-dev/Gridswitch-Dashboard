import { NextResponse } from 'next/server';
import { hydrateEmbeddedAiResearch } from '@/lib/ai-research-storage';
import { mockProspects } from '@/lib/providers/mock';
import { normalizeResearch } from '@/lib/research-qualification';
import { adminDb } from '@/lib/supabase';
import type { Prospect } from '@/lib/types';

// EPA TRI provides PA longitudes as unsigned degrees. Correct legacy rows at
// read time too, so the map is immediately repaired without waiting for a
// re-import to overwrite every previously stored record.
function mapReadyCoordinates(prospect: Prospect): Prospect {
  const latitude = Number(prospect.latitude);
  const longitude = Number(prospect.longitude);
  const isUnsignedPennsylvaniaLongitude =
    prospect.provider === 'public_pipeline' &&
    /^(PA|Pennsylvania)$/i.test(prospect.state ?? '') &&
    latitude >= 38 && latitude <= 43 &&
    longitude > 70 && longitude < 82;
  return isUnsignedPennsylvaniaLongitude ? { ...prospect, longitude: -Math.abs(longitude) } : prospect;
}

export async function GET() {
  const db = adminDb();
  if (!db) return NextResponse.json({ prospects: mockProspects, demo: true });
  const { data, error } = await db
    .from('prospects')
    .select('*')
    .order('opportunity_score', { ascending: false });
  if (error) {
    console.error('Unable to load prospects', error.message);
    return NextResponse.json(
      {
        prospects: [],
        demo: false,
        error: 'Unable to load prospects. Confirm the Supabase migration and server key.',
      },
      { status: 500 },
    );
  }
  if ((data?.length ?? 0) === 0) {
    return NextResponse.json({ prospects: mockProspects, demo: true });
  }
  const prospects = (data as Prospect[]).map(mapReadyCoordinates).map(hydrateEmbeddedAiResearch).map((prospect) =>
    prospect.ai_research
      ? { ...prospect, ai_research: normalizeResearch(prospect.ai_research) }
      : prospect,
  );
  return NextResponse.json({
    prospects,
    demo: false,
  });
}
