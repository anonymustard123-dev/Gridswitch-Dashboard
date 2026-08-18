import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/supabase';
import { researchProspect } from '@/lib/providers/openai-research';

export const maxDuration = 60;

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const db = adminDb();
  if (!db) return NextResponse.json({ error: 'Supabase is not configured.' }, { status: 503 });
  const { id } = await params;
  const { data: prospect, error } = await db.from('prospects').select('*').eq('id', id).single();
  if (error || !prospect) return NextResponse.json({ error: 'Prospect not found.' }, { status: 404 });
  const { error: startError } = await db.from('prospects').update({ ai_research_status: 'researching', ai_error: null }).eq('id', id);
  if (startError) return NextResponse.json({ error: 'AI research fields are not available yet. Run supabase/migrations/202608180002_add_ai_research.sql in the Supabase SQL Editor.' }, { status: 503 });
  try {
    const result = await researchProspect(prospect);
    const { data, error: updateError } = await db.from('prospects').update({ ai_research_status: 'complete', ai_research: result.research, ai_researched_at: new Date().toISOString(), ai_model: result.model, ai_error: null }).eq('id', id).select('*').single();
    if (updateError) throw updateError;
    return NextResponse.json({ prospect: data });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'AI research failed.';
    console.error('AI facility research failed', message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]'));
    await db.from('prospects').update({ ai_research_status: 'failed', ai_error: message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') }).eq('id', id);
    return NextResponse.json({ error: message.replace(/sk-[A-Za-z0-9_-]+/g, '[redacted]') }, { status: /OPENAI_API_KEY/.test(message) ? 503 : 502 });
  }
}
