import type { Prospect } from '@/lib/types';

type RawListing = {
  category?: string; additional_categories?: string[]; category_ids?: string[]; phone?: string; url?: string;
  people_also_search?: unknown[]; place_topics?: Record<string, number>;
  work_time?: { work_hours?: { timetable?: Record<string, { open?: { hour?: number; minute?: number }; close?: { hour?: number; minute?: number } }[]> } };
};

export type ProspectSignalTier = 'listing_only' | 'call_ready' | 'strong_operating_signal';
export interface ProspectSignals { score: number; tier: ProspectSignalTier; categories: string[]; is24Hour: boolean; logisticsCues: string[]; relatedListings: number; reasons: string[]; }

const clean = (value: string) => value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
const logisticsTopics = new Set(['trucks', 'live load', 'drop and hook', 'shipping office', 'trailer inspection', 'clean trailer', 'security']);

export function prospectSignals(prospect: Prospect): ProspectSignals {
  const raw = (prospect.dataforseo_raw ?? {}) as RawListing;
  const categories = [...new Set([prospect.source_category, raw.category, ...(raw.additional_categories ?? []), ...(raw.category_ids ?? [])].filter((value): value is string => Boolean(value)))];
  const timetable = raw.work_time?.work_hours?.timetable ?? {};
  const dailyHours = Object.values(timetable).flat().filter((period): period is NonNullable<typeof period> => Boolean(period));
  const is24Hour = dailyHours.length >= 5 && dailyHours.every((period) => period?.open?.hour === 0 && period?.open?.minute === 0 && period?.close?.hour === 24 && period?.close?.minute === 0);
  const logisticsCues = Object.keys(raw.place_topics ?? {}).filter((topic) => logisticsTopics.has(topic));
  const relatedListings = raw.people_also_search?.length ?? 0;
  const hasContact = Boolean(prospect.phone || raw.phone) && Boolean(prospect.website || raw.url);
  let score = prospect.facility_type && prospect.facility_type !== 'unknown' ? 25 : 0;
  if (categories.length >= 2) score += 15;
  if (is24Hour) score += 25;
  if (logisticsCues.length >= 2) score += 15; else if (logisticsCues.length) score += 8;
  if (hasContact) score += 10;
  if (relatedListings >= 2) score += 5;
  if (prospect.epa_frs_id || prospect.pa_dep_facility_id) score += 10;
  score = Math.min(score, 100);
  const tier: ProspectSignalTier = score >= 65 ? 'strong_operating_signal' : score >= 40 ? 'call_ready' : 'listing_only';
  const reasons = [
    prospect.facility_type && prospect.facility_type !== 'unknown' ? `${clean(prospect.facility_type)} category` : null,
    categories.length >= 2 ? `${categories.length} business categories` : null,
    is24Hour ? 'Listed 24/7 hours' : null,
    logisticsCues.length ? `Operations cues: ${logisticsCues.map(clean).join(', ')}` : null,
    hasContact ? 'Website and phone available' : null,
    relatedListings >= 2 ? `${relatedListings} related business listings nearby` : null,
    prospect.epa_frs_id || prospect.pa_dep_facility_id ? 'Public facility record match' : null,
  ].filter((reason): reason is string => Boolean(reason));
  return { score, tier, categories, is24Hour, logisticsCues, relatedListings, reasons };
}

export const prospectSignalLabels: Record<ProspectSignalTier, string> = { listing_only: 'Listing only', call_ready: 'Call ready', strong_operating_signal: 'Strong operating signal' };
