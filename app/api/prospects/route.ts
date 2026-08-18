import { NextResponse } from 'next/server';
import { hydrateEmbeddedAiResearch } from '@/lib/ai-research-storage';
import { mockProspects } from '@/lib/providers/mock';
import { normalizeResearch } from '@/lib/providers/openai-research';
import { adminDb } from '@/lib/supabase';
import type { Prospect } from '@/lib/types';

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
  const prospects = (data as Prospect[]).map(hydrateEmbeddedAiResearch).map((prospect) =>
    prospect.ai_research
      ? { ...prospect, ai_research: normalizeResearch(prospect.ai_research) }
      : prospect,
  );
  return NextResponse.json({
    prospects,
    demo: false,
  });
}
