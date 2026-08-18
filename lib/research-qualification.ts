import type { AiFacilityResearch } from '@/lib/types';

export function normalizeResearch(research: AiFacilityResearch): AiFacilityResearch {
  // Stored results from the earlier schema do not have the qualification matrix.
  // Return them unchanged rather than breaking the entire prospects response.
  if (!research?.qualification || !Array.isArray(research.sources)) return research;

  const sourceUrls = new Set(research.sources.map((source) => source.url));
  const absenceLanguage = /\b(no (?:public|direct|site-specific|documented|source)|not found|could not (?:find|verify)|does not (?:show|establish|document)|unknown)\b/i;
  const cleanSignal = (signal: AiFacilityResearch['qualification']['load_intensity']) => ({
    ...signal,
    source_url: signal.source_url && sourceUrls.has(signal.source_url) ? signal.source_url : null,
    rating:
      absenceLanguage.test(signal.evidence)
        ? 'unknown' as const
        : signal.source_url && sourceUrls.has(signal.source_url)
          ? signal.rating
          : signal.rating === 'unknown'
            ? 'unknown' as const
            : 'possible' as const,
  });
  const qualification = {
    load_intensity: cleanSignal(research.qualification.load_intensity),
    uptime_criticality: cleanSignal(research.qualification.uptime_criticality),
    resilience_need: cleanSignal(research.qualification.resilience_need),
    expansion_or_capex: cleanSignal(research.qualification.expansion_or_capex),
    onsite_energy_assets: cleanSignal(research.qualification.onsite_energy_assets),
  };
  const load = qualification.load_intensity.rating;
  const continuity = [qualification.uptime_criticality.rating, qualification.resilience_need.rating];
  const gridSwitchFit: AiFacilityResearch['grid_switch_fit'] =
    load === 'strong' && continuity.includes('strong')
      ? 'high'
      : (load === 'strong' && continuity.includes('possible')) ||
          (load === 'possible' && continuity.includes('strong'))
        ? 'moderate'
        : load === 'weak'
          ? 'low'
          : 'unknown';
  const recommendedAction: AiFacilityResearch['recommended_action'] =
    gridSwitchFit === 'high' || gridSwitchFit === 'moderate'
      ? 'prioritize_outreach'
      : gridSwitchFit === 'low'
        ? 'deprioritize'
        : 'research_more';
  return {
    ...research,
    grid_switch_fit: gridSwitchFit,
    qualification,
    recommended_action: recommendedAction,
    operating_evidence: (research.operating_evidence ?? []).filter((claim) =>
      sourceUrls.has(claim.source_url),
    ),
  };
}
