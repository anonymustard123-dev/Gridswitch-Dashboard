import { z } from 'zod';
import { serverEnv } from '@/lib/env';
import type { AiFacilityResearch, Prospect } from '@/lib/types';

const sourceSchema = z.object({ title: z.string(), url: z.string().url() });
const claimSchema = z.object({
  claim: z.string(),
  evidence_type: z.enum(['operations', 'scale', 'expansion', 'resilience', 'energy', 'other']),
  confidence: z.enum(['high', 'medium', 'low']),
  source_url: z.string().url(),
});
const qualificationSignalSchema = z.object({
  rating: z.enum(['strong', 'possible', 'weak', 'unknown']),
  evidence: z.string(),
  source_url: z.string().url().nullable(),
});
const researchSchema = z.object({
  facility_summary: z.string(),
  grid_switch_fit: z.enum(['high', 'moderate', 'low', 'unknown']),
  fit_reasons: z.array(z.string()).max(5),
  qualification: z.object({
    load_intensity: qualificationSignalSchema,
    uptime_criticality: qualificationSignalSchema,
    resilience_need: qualificationSignalSchema,
    expansion_or_capex: qualificationSignalSchema,
    onsite_energy_assets: qualificationSignalSchema,
  }),
  operating_evidence: z.array(claimSchema).max(8),
  recommended_action: z.enum(['prioritize_outreach', 'research_more', 'deprioritize']),
  recommended_action_reason: z.string(),
  outreach_angle: z.string(),
  target_roles: z.array(z.string()).max(5),
  discovery_questions: z.array(z.string()).max(6),
  disqualifiers: z.array(z.string()).max(5),
  unknowns: z.array(z.string()).max(6),
  sources: z.array(sourceSchema).max(10),
});

const qualificationSignalJsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    rating: { type: 'string', enum: ['strong', 'possible', 'weak', 'unknown'] },
    evidence: { type: 'string' },
    source_url: { type: ['string', 'null'] },
  },
  required: ['rating', 'evidence', 'source_url'],
};

const jsonSchema = {
  type: 'object',
  additionalProperties: false,
  properties: {
    facility_summary: { type: 'string' },
    grid_switch_fit: { type: 'string', enum: ['high', 'moderate', 'low', 'unknown'] },
    fit_reasons: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    qualification: {
      type: 'object',
      additionalProperties: false,
      properties: {
        load_intensity: qualificationSignalJsonSchema,
        uptime_criticality: qualificationSignalJsonSchema,
        resilience_need: qualificationSignalJsonSchema,
        expansion_or_capex: qualificationSignalJsonSchema,
        onsite_energy_assets: qualificationSignalJsonSchema,
      },
      required: [
        'load_intensity',
        'uptime_criticality',
        'resilience_need',
        'expansion_or_capex',
        'onsite_energy_assets',
      ],
    },
    operating_evidence: {
      type: 'array',
      maxItems: 8,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: {
          claim: { type: 'string' },
          evidence_type: {
            type: 'string',
            enum: ['operations', 'scale', 'expansion', 'resilience', 'energy', 'other'],
          },
          confidence: { type: 'string', enum: ['high', 'medium', 'low'] },
          source_url: { type: 'string' },
        },
        required: ['claim', 'evidence_type', 'confidence', 'source_url'],
      },
    },
    recommended_action: {
      type: 'string',
      enum: ['prioritize_outreach', 'research_more', 'deprioritize'],
    },
    recommended_action_reason: { type: 'string' },
    outreach_angle: { type: 'string' },
    target_roles: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    discovery_questions: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    disqualifiers: { type: 'array', items: { type: 'string' }, maxItems: 5 },
    unknowns: { type: 'array', items: { type: 'string' }, maxItems: 6 },
    sources: {
      type: 'array',
      maxItems: 10,
      items: {
        type: 'object',
        additionalProperties: false,
        properties: { title: { type: 'string' }, url: { type: 'string' } },
        required: ['title', 'url'],
      },
    },
  },
  required: [
    'facility_summary',
    'grid_switch_fit',
    'fit_reasons',
    'qualification',
    'operating_evidence',
    'recommended_action',
    'recommended_action_reason',
    'outreach_angle',
    'target_roles',
    'discovery_questions',
    'disqualifiers',
    'unknowns',
    'sources',
  ],
};

function responseText(body: unknown) {
  const response = body as {
    output_text?: string;
    output?: Array<{ content?: Array<{ type?: string; text?: string }> }>;
  };
  if (typeof response.output_text === 'string') return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === 'output_text' && typeof content.text === 'string') return content.text;
    }
  }
  return '';
}

function cleanResearch(research: AiFacilityResearch): AiFacilityResearch {
  const sourceUrls = new Set(research.sources.map((source) => source.url));
  const cleanSignal = (signal: AiFacilityResearch['qualification']['load_intensity']) => ({
    ...signal,
    source_url: signal.source_url && sourceUrls.has(signal.source_url) ? signal.source_url : null,
    rating:
      signal.source_url && sourceUrls.has(signal.source_url)
        ? signal.rating
        : signal.rating === 'unknown'
          ? 'unknown' as const
          : 'possible' as const,
  });
  return {
    ...research,
    qualification: {
      load_intensity: cleanSignal(research.qualification.load_intensity),
      uptime_criticality: cleanSignal(research.qualification.uptime_criticality),
      resilience_need: cleanSignal(research.qualification.resilience_need),
      expansion_or_capex: cleanSignal(research.qualification.expansion_or_capex),
      onsite_energy_assets: cleanSignal(research.qualification.onsite_energy_assets),
    },
    operating_evidence: research.operating_evidence.filter((claim) =>
      sourceUrls.has(claim.source_url),
    ),
  };
}

export async function researchProspect(
  prospect: Prospect,
): Promise<{ research: AiFacilityResearch; model: string }> {
  if (!serverEnv.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY is not configured in Vercel.');
  const model = serverEnv.OPENAI_MODEL;
  const identity = [
    prospect.name,
    prospect.address,
    prospect.city,
    prospect.state,
    prospect.postal_code,
    prospect.website,
  ]
    .filter(Boolean)
    .join(' | ');

  const response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${serverEnv.OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    signal: AbortSignal.timeout(55_000),
    body: JSON.stringify({
      model,
      tools: [{ type: 'web_search', search_context_size: 'medium' }],
      input: `Research this exact physical facility for GridSwitch microgrid prospecting: ${identity}.

The business-directory record is discovery input, not proof of microgrid fit. Use public web sources, prioritizing the facility/company website, government and permit records, utility or regulatory documents, SEC filings, and reputable business news. Confirm each fact applies to this location rather than merely the parent company.

Evaluate only these microgrid-relevant questions:
1. Is there evidence of a large or continuous electrical-load process at this site?
2. Is uptime operationally critical or are outages plausibly costly?
3. Is there site-specific resilience need, outage history, utility constraint, or continuity requirement?
4. Is the site expanding or making capital investments that create a buying window?
5. Are existing generators, solar, storage, CHP, switchgear, or energy projects documented?

Never estimate electricity consumption, peak load, tariff savings, or project economics. A warehouse, truck lot, or 24/7 listing is not high fit without additional site-specific evidence. Use unknown when evidence is absent. Every non-unknown qualification signal and every operating_evidence claim must include a supporting URL. Recommend a concrete next action and the facility roles to approach, but do not invent named contacts.`,
      text: {
        format: {
          type: 'json_schema',
          name: 'grid_switch_facility_research',
          strict: true,
          schema: jsonSchema,
        },
      },
    }),
  });

  const body = await response.json().catch(() => null);
  if (!response.ok) {
    const message = (body as { error?: { message?: string } } | null)?.error?.message;
    throw new Error(
      `OpenAI research failed (HTTP ${response.status})${message ? `: ${message}` : ''}`,
    );
  }

  let decoded: unknown;
  try {
    decoded = JSON.parse(responseText(body));
  } catch {
    throw new Error('OpenAI returned an unreadable research result.');
  }
  const parsed = researchSchema.safeParse(decoded);
  if (!parsed.success) throw new Error('OpenAI returned an invalid research result.');
  return { research: cleanResearch(parsed.data), model };
}
