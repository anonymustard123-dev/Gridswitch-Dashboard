import { NextResponse } from 'next/server';
import { embedAiResearch } from '@/lib/ai-research-storage';
import { researchProspect } from '@/lib/providers/openai-research';
import { adminDb } from '@/lib/supabase';
import type { Prospect } from '@/lib/types';

export const maxDuration = 60;

const redact = (message: string) => message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]');

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  const { id } = await params;
  const { data: prospectData, error } = await db
    .from('prospects')
    .select('*')
    .eq('id', id)
    .single();
  if (error || !prospectData) {
    return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  }
  const prospect = prospectData as Prospect;

  // Newer databases use dedicated columns. Existing deployments keep working by
  // embedding the research in dataforseo_raw until the optional migration is run.
  const { error: startError } = await db
    .from('prospects')
    .update({ ai_research_status: 'researching', ai_error: null })
    .eq('id', id);
  const hasResearchColumns = !startError;

  try {
    const result = await researchProspect(prospect);
    const researchedAt = new Date().toISOString();
    const researchFields = {
      ai_research_status: 'complete' as const,
      ai_research: result.research,
      ai_researched_at: researchedAt,
      ai_model: result.model,
      ai_error: null,
    };

    if (hasResearchColumns) {
      const { data, error: updateError } = await db
        .from('prospects')
        .update(researchFields)
        .eq('id', id)
        .select('*')
        .single();
      if (!updateError && data) return NextResponse.json({ prospect: data });
    }

    const embeddedRaw = embedAiResearch(prospect.dataforseo_raw, {
      status: 'complete',
      research: result.research,
      researched_at: researchedAt,
      model: result.model,
      error: null,
    });
    const { error: fallbackError } = await db
      .from('prospects')
      .update({ dataforseo_raw: embeddedRaw })
      .eq('id', id);
    if (fallbackError) throw fallbackError;
    return NextResponse.json({ prospect: { ...prospect, ...researchFields, dataforseo_raw: embeddedRaw } });
  } catch (cause) {
    const message = redact(cause instanceof Error ? cause.message : 'AI research failed.');
    console.error('AI facility research failed', message);
    if (hasResearchColumns) {
      await db
        .from('prospects')
        .update({ ai_research_status: 'failed', ai_error: message })
        .eq('id', id);
    } else {
      await db
        .from('prospects')
        .update({
          dataforseo_raw: embedAiResearch(prospect.dataforseo_raw, {
            status: 'failed',
            error: message,
          }),
        })
        .eq('id', id);
    }
    return NextResponse.json(
      { error: message },
      { status: /OPENAI_API_KEY/.test(message) ? 503 : 502 },
    );
  }
}
