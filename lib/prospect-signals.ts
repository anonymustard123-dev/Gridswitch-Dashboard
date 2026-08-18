import { ENERGY_FACTORS } from '@/lib/scoring';
import type { Prospect } from '@/lib/types';

type RawListing = {
  category?: string;
  additional_categories?: string[];
  category_ids?: string[];
  phone?: string;
  url?: string;
  people_also_search?: unknown[];
  place_topics?: Record<string, number>;
  work_time?: {
    work_hours?: {
      timetable?: Record<
        string,
        Array<{
          open?: { hour?: number; minute?: number };
          close?: { hour?: number; minute?: number };
        } | null>
      >;
    };
  };
};

export type ProspectSignalTier = 'unqualified_listing' | 'possible_fit' | 'priority_category';

export interface ProspectSignals {
  score: number;
  tier: ProspectSignalTier;
  categories: string[];
  is24Hour: boolean;
  logisticsCues: string[];
  relatedListings: number;
  hasContact: boolean;
  relevanceReasons: string[];
  directoryFacts: string[];
  unknowns: string[];
}

const clean = (value: string) =>
  value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());

const logisticsTopics = new Set([
  'trucks',
  'live load',
  'drop and hook',
  'shipping office',
  'trailer inspection',
  'clean trailer',
  'security',
]);

export function prospectSignals(prospect: Prospect): ProspectSignals {
  const raw = (prospect.dataforseo_raw ?? {}) as RawListing;
  const categories = [
    ...new Set(
      [
        prospect.source_category,
        raw.category,
        ...(raw.additional_categories ?? []),
        ...(raw.category_ids ?? []),
      ].filter((value): value is string => Boolean(value)),
    ),
  ];
  const timetable = raw.work_time?.work_hours?.timetable ?? {};
  const dailyHours = Object.values(timetable).flat().filter(Boolean);
  const is24Hour =
    dailyHours.length >= 5 &&
    dailyHours.every(
      (period) =>
        period?.open?.hour === 0 &&
        period?.open?.minute === 0 &&
        period?.close?.hour === 24 &&
        period?.close?.minute === 0,
    );
  const logisticsCues = Object.keys(raw.place_topics ?? {}).filter((topic) =>
    logisticsTopics.has(topic),
  );
  const relatedListings = raw.people_also_search?.length ?? 0;
  const hasContact = Boolean(prospect.phone || raw.phone || prospect.website || raw.url);
  const factor = ENERGY_FACTORS[prospect.facility_type || 'unknown'] ?? ENERGY_FACTORS.unknown;

  // This score is only an internal discovery sort. It is deliberately dominated
  // by the facility-type prior and is never presented as a microgrid-fit score.
  const score = Math.min(100, Math.round(factor * 10 + (is24Hour ? 5 : 0)));
  const tier: ProspectSignalTier =
    factor >= 7 ? 'priority_category' : factor >= 5 || is24Hour ? 'possible_fit' : 'unqualified_listing';

  const relevanceReasons = [
    factor >= 8
      ? `${clean(prospect.facility_type || 'facility')} is a higher-load-intensity facility category`
      : factor >= 5
        ? `${clean(prospect.facility_type || 'facility')} can have meaningful site loads`
        : null,
    is24Hour ? 'Listed 24/7; uptime and outage exposure may matter' : null,
    prospect.epa_frs_id || prospect.pa_dep_facility_id
      ? 'Matched to a public operating-facility record'
      : null,
  ].filter((reason): reason is string => Boolean(reason));

  const directoryFacts = [
    prospect.facility_type && prospect.facility_type !== 'unknown'
      ? `${clean(prospect.facility_type)} business category`
      : null,
    categories.length >= 2 ? `${categories.length} listing categories` : null,
    is24Hour ? 'Business profile lists 24/7 hours' : null,
    logisticsCues.length ? `Listing topics: ${logisticsCues.map(clean).join(', ')}` : null,
    hasContact ? 'Phone or website available for outreach' : null,
    relatedListings >= 2 ? `${relatedListings} related listings nearby` : null,
  ].filter((fact): fact is string => Boolean(fact));

  return {
    score,
    tier,
    categories,
    is24Hour,
    logisticsCues,
    relatedListings,
    hasContact,
    relevanceReasons,
    directoryFacts,
    unknowns: [
      'Actual peak and interval load',
      'Cost of outages and required uptime',
      'Utility tariff, demand charges, and constraints',
      'Existing generators, solar, storage, or switchgear',
      'Site control, available space, and capital timing',
    ],
  };
}

export const prospectSignalLabels: Record<ProspectSignalTier, string> = {
  unqualified_listing: 'Unqualified listing',
  possible_fit: 'Possible fit',
  priority_category: 'Priority category',
};
