import type { AiFacilityResearch, Prospect } from '@/lib/types';

const STORAGE_KEY = '_gridswitch_ai_research';

type EmbeddedResearch = {
  status?: Prospect['ai_research_status'];
  research?: AiFacilityResearch | null;
  researched_at?: string | null;
  model?: string | null;
  error?: string | null;
};

function rawObject(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === 'object' && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};
}

export function embedAiResearch(raw: unknown, embedded: EmbeddedResearch) {
  return { ...rawObject(raw), [STORAGE_KEY]: embedded };
}

export function hydrateEmbeddedAiResearch(prospect: Prospect): Prospect {
  if (prospect.ai_research || prospect.ai_research_status === 'complete') return prospect;
  const embedded = rawObject(prospect.dataforseo_raw)[STORAGE_KEY] as
    | EmbeddedResearch
    | undefined;
  if (!embedded) return prospect;
  return {
    ...prospect,
    ai_research_status: embedded.status ?? prospect.ai_research_status,
    ai_research: embedded.research ?? prospect.ai_research,
    ai_researched_at: embedded.researched_at ?? prospect.ai_researched_at,
    ai_model: embedded.model ?? prospect.ai_model,
    ai_error: embedded.error ?? prospect.ai_error,
  };
}
