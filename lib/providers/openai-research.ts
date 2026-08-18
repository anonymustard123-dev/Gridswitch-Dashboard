import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import type { AiFacilityResearch, Prospect } from '@/lib/types';

const sourceSchema = z.object({ title: z.string(), url: z.string().url() });
const claimSchema = z.object({ claim: z.string(), evidence_type: z.enum(['operations', 'scale', 'expansion', 'resilience', 'energy', 'other']), confidence: z.enum(['high', 'medium', 'low']), source_url: z.string().url() });
const researchSchema = z.object({ facility_summary: z.string(), grid_switch_fit: z.enum(['high', 'moderate', 'low', 'unknown']), fit_reasons: z.array(z.string()).max(5), operating_evidence: z.array(claimSchema).max(8), outreach_angle: z.string(), discovery_questions: z.array(z.string()).max(6), unknowns: z.array(z.string()).max(6), sources: z.array(sourceSchema).max(10) });

const jsonSchema = {
  type: 'object', additionalProperties: false,
  properties: {
    facility_summary: { type: 'string' }, grid_switch_fit: { type: 'string', enum: ['high', 'moderate', 'low', 'unknown'] },
    fit_reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    operating_evidence: { type: 'array', maxItems: 8, items: { type: 'object', additionalProperties: false, properties: { claim: { type: 'string' }, evidence_type: { type: 'string', enum: ['operations', 'scale', 'expansion', 'resilience', 'energy', 'other'] }, confidence: { type: 'string', enum: ['high', 'medium', 'low'] }, source_url: { type: 'string' } }, required: ['claim', 'evidence_type', 'confidence', 'source_url'] } },
    outreach_angle: { type: 'string' }, discovery_questions: { type: 'array', items: { type: 'string' }, maxItems: 6 }, unknowns: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    sources: { type: 'array', maxItems: 10, items: { type: 'object', additionalProperties: false, properties: { title: { type: 'string' }, url: { type: 'string' } }, required: ['title', 'url'] } },
  }, required: ['facility_summary', 'grid_switch_fit', 'fit_reasons', 'operating_evidence', 'outreach_angle', 'discovery_questions', 'unknowns', 'sources'],
};

function responseText(body: any) {
  if (typeof body.output_text === 'string') return body.output_text;
  for (const item of body.output ?? []) for (const content of item.content ?? []) if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
  return '';
}

export async function researchProspect(prospect: Prospect): Promise<{ research: AiFacilityResearch; model: string }> {
  if (!serverEnv.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured.');
  const model = serverEnv.OPENAI_MODEL;
  const identity = [prospect.name, prospect.address, prospect.city, prospect.state, prospect.postal_code, prospect.website].filter(Boolean).join(' | ');
  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST', headers: { Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`, 'Content-Type': 'application/json' }, signal: AbortSignal.timeout(55_000),
    body: JSON.stringify({
      model, tools: [{ type: 'web_search', search_context_size: 'medium' }],
      input: `Research this exact physical facility for GridSwitch microgrid prospecting: ${identity}.\nUse public web sources, prioritizing the company website, government/permit records, utility/regulatory documents, SEC filings, and reputable business news. Confirm that evidence is about this location, not merely the parent company. Find source-backed evidence of facility operations, scale, expansion/capital investment, 24/7 or critical operations, backup generation, resilience needs, or energy-intensive processes. Never estimate electricity consumption, peak load, or project economics. If a fact cannot be verified, put it in unknowns. Every operating_evidence item must include the source URL that supports it. Set grid_switch_fit to unknown unless cited evidence supports a directional outreach priority; it is not project qualification.`,
      text: { format: { type: 'json_schema', name: 'grid_switch_facility_research', strict: true, schema: jsonSchema } },
    }),
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(`OpenAI research failed (HTTP ${response.status})${body?.error?.message ? `: ${body.error.message}` : ''}`);
  const parsed = researchSchema.safeParse(JSON.parse(responseText(body)));
  if (!parsed.success) throw new Error('OpenAI returned an invalid research result.');
  const sourceUrls = new Set(parsed.data.sources.map((source) => source.url));
  const research = { ...parsed.data, operating_evidence: parsed.data.operating_evidence.filter((claim) => sourceUrls.has(claim.source_url)) };
  return { research, model };
}
