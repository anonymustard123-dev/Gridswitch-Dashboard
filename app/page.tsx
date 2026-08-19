'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProspectMap from '@/components/ProspectMap';
import {
  prospectSignalLabels,
  prospectSignals,
  type ProspectSignalTier,
} from '@/lib/prospect-signals';
import { DEFAULT_SCORE_WEIGHTS, microgridFitLabels, microgridProfile, reportedParentCompany, SCORE_METRIC_GUIDES, type ScoreWeights } from '@/lib/microgrid-profile';
import type { AiFacilityResearch, Prospect } from '@/lib/types';

const label = (value: string | null | undefined) =>
  value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown';
const signalFor = (prospect: Prospect, weights?: ScoreWeights) => prospectSignals(prospect, weights);

const weightControls: Array<{ key: keyof ScoreWeights; title: string; help: string }> = [
  { key: 'process', title: 'Industry and process fit', help: 'What the facility makes or does. Energy-heavy processes score higher.' },
  { key: 'operating', title: 'Reported operating scale', help: 'GHGRP and TRI reporting that signals a meaningful industrial operation.' },
  { key: 'scale', title: 'Physical site evidence', help: 'Only actual building, footprint, or parcel information earns points.' },
  { key: 'outreach', title: 'Outreach readiness', help: 'A parent company and practical way to contact the facility.' },
];
const shortText = (value: string | null | undefined, words: number) => {
  const clean = (value ?? '').replace(/\s*\(\[[^\]]+\]\([^)]*\)\)/g, '').replace(/\s+/g, ' ').trim();
  const compact = clean.split(' ').slice(0, words).join(' ');
  return clean.split(' ').length > words ? `${compact}…` : compact;
};
const publicRecordFacts = (prospect: Prospect) => {
  const raw = (prospect.public_records_raw ?? {}) as { ghgrp?: Record<string, unknown>; tri?: Record<string, unknown> };
  const ghgrp = raw.ghgrp;
  const tri = raw.tri;
  return [
    prospect.epa_frs_id ? `EPA Registry ID: ${prospect.epa_frs_id}` : null,
    prospect.epa_programs?.length ? `EPA programs: ${prospect.epa_programs.join(', ')}` : null,
    ghgrp?.naics_code ? `GHGRP NAICS: ${ghgrp.naics_code}` : null,
    ghgrp?.facility_types ? `GHGRP facility type: ${ghgrp.facility_types}` : null,
    ghgrp?.reported_industry_types ? `GHGRP reported industry codes: ${ghgrp.reported_industry_types}` : null,
    ghgrp?.reported_subparts ? `GHGRP reporting subparts: ${ghgrp.reported_subparts}` : null,
    ghgrp?.latest_reported_emissions ? `GHGRP reported emissions: ${Number(ghgrp.latest_reported_emissions).toLocaleString()} metric tons CO₂e${ghgrp.emissions_reporting_year ? ` (${ghgrp.emissions_reporting_year})` : ''}` : null,
    ghgrp?.parent_company ? `Reported parent company: ${ghgrp.parent_company}` : null,
    tri ? `EPA TRI status: active industrial facility record` : null,
    tri?.tri_facility_id ? `TRI facility ID: ${tri.tri_facility_id}` : null,
    tri?.primary_naics_code || tri?.naics_code || tri?.industry_sector_code ? `TRI NAICS: ${tri.primary_naics_code || tri.naics_code || tri.industry_sector_code}` : null,
    tri?.industry_sector ? `TRI industry sector: ${tri.industry_sector}` : null,
    tri?.reported_production_waste_lbs ? `TRI production-related reporting: ${Number(tri.reported_production_waste_lbs).toLocaleString()} pounds${tri.tri_reporting_year ? ` (${tri.tri_reporting_year})` : ''}` : null,
    tri?.production_ratio_or_activity_index ? `TRI production/activity indicator: ${tri.production_ratio_or_activity_index}` : null,
    tri?.parent_co_name && tri.parent_co_name !== 'NA' ? `Reported parent company: ${tri.parent_co_name}` : null,
  ].filter((fact): fact is string => Boolean(fact));
};

const csvValue = (value: unknown) => {
  const text = String(value ?? '');
  return `"${text.replaceAll('"', '""')}"`;
};

const tierStyle: Record<ProspectSignalTier, string> = {
  top_priority: 'bg-emerald-100 text-emerald-800',
  priority_site: 'bg-teal-100 text-teal-800',
  industrial_lead: 'bg-amber-100 text-amber-900',
  category_lead: 'bg-sky-100 text-sky-800',
  potential_site: 'bg-slate-200 text-slate-700',
};
const fitStyle: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-200 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};

function AiResearch({ research }: { research: AiFacilityResearch }) {
  const facts = (research.fit_reasons ?? [])
    .filter((reason) => !/no (?:public|direct|site-specific)|unknown/i.test(reason))
    .slice(0, 3);
  return (
    <section className="mt-6 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">AI opportunity brief</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${fitStyle[research.grid_switch_fit]}`}>
          {research.grid_switch_fit === 'unknown' ? 'More research needed' : `${research.grid_switch_fit} priority`}
        </span>
      </div>
      <p className="mt-3 text-sm">{shortText(research.facility_summary, 42) || 'No facility-specific AI summary is available yet.'}</p>
      {facts.length > 0 && <ul className="mt-3 space-y-1 text-sm">{facts.map((fact) => <li key={fact}>• {shortText(fact, 22)}</li>)}</ul>}
      <div className="mt-4 rounded bg-slate-900 p-3 text-sm text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Next move</div>
        <p className="mt-1 font-semibold">{shortText(research.recommended_action_reason, 28) || 'Review the public-source evidence before outreach.'}</p>
      </div>
      {research.outreach_angle && <p className="mt-3 text-sm"><b>Talk track:</b> {shortText(research.outreach_angle, 28)}</p>}
      {research.sources?.length > 0 && (
        <a className="mt-3 inline-block text-xs text-teal-700 underline" href={research.sources[0].url} target="_blank" rel="noreferrer">
          Open research source
        </a>
      )}
    </section>
  );
}

function ScoreGuide({ metric, weights, onClose }: { metric: keyof ScoreWeights | 'all'; weights: ScoreWeights; onClose: () => void }) {
  const guides = metric === 'all' ? weightControls : weightControls.filter((item) => item.key === metric);
  return <div className="fixed inset-0 z-30 grid place-items-center bg-slate-950/45 p-4" role="dialog" aria-modal="true" aria-label="Score card breakdown">
    <section className="score-guide card max-h-[85vh] w-full max-w-3xl overflow-auto p-6 shadow-2xl">
      <div className="flex items-start justify-between gap-5"><div><p className="text-xs font-bold uppercase tracking-[0.16em] text-emerald-700">GridSwitch scorecard</p><h2 className="mt-1 text-2xl font-bold text-slate-950">{metric === 'all' ? 'How every score is calculated' : SCORE_METRIC_GUIDES[metric].title}</h2><p className="mt-2 text-sm text-slate-600">These rules apply consistently to every facility. The adjusted maximum reflects the current weight setting.</p></div><button className="control shrink-0" onClick={onClose}>Close</button></div>
      <div className="mt-6 space-y-4">{guides.map((item) => { const guide = SCORE_METRIC_GUIDES[item.key]; return <article className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-4" key={item.key}><div className="flex items-start justify-between gap-3"><div><h3 className="font-semibold text-slate-950">{guide.title}</h3><p className="mt-1 text-sm text-slate-600">{guide.description}</p></div><span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">Max {weights[item.key]} pts</span></div><ul className="mt-4 space-y-2 text-sm text-slate-700">{guide.rules.map((rule) => <li key={rule}>• {rule}</li>)}</ul></article>; })}</div>
    </section>
  </div>;
}

export default function Dashboard() {
  const [all, setAll] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [tier, setTier] = useState('');
  const [showScreening, setShowScreening] = useState(false);
  const [showWeights, setShowWeights] = useState(false);
  const [scoreWeights, setScoreWeights] = useState<ScoreWeights>(DEFAULT_SCORE_WEIGHTS);
  const [scoreGuideMetric, setScoreGuideMetric] = useState<keyof ScoreWeights | 'all' | null>(null);
  const [darkMode, setDarkMode] = useState(false);
  const [demo, setDemo] = useState(false);
  const [searching, setSearching] = useState(false);
  const [importingPublic, setImportingPublic] = useState(false);
  const [initialPublicImportStarted, setInitialPublicImportStarted] = useState(false);
  const [researchingIds, setResearchingIds] = useState<string[]>([]);
  const [researchErrors, setResearchErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState('');

  const loadProspects = useCallback(async () => {
    try {
      const response = await fetch('/api/prospects');
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload) throw new Error(payload?.error || 'Unable to load prospects.');
      setAll(Array.isArray(payload.prospects) ? payload.prospects : []);
      setDemo(Boolean(payload.demo));
      if (payload.error) setNotice(payload.error);
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to load prospects.');
    }
  }, []);

  useEffect(() => { void loadProspects(); }, [loadProspects]);

  const list = useMemo(
    () => all
      .filter((prospect) =>
        (!city || prospect.city === city) &&
        (!type || prospect.facility_type === type) &&
        (!tier || signalFor(prospect, scoreWeights).tier === tier) &&
        (showScreening || signalFor(prospect, scoreWeights).tier !== 'potential_site') &&
        `${prospect.name} ${prospect.address}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => signalFor(b, scoreWeights).score - signalFor(a, scoreWeights).score),
    [all, city, type, tier, query, showScreening, scoreWeights],
  );

  async function importPublicPipeline() {
    setImportingPublic(true);
    try {
      const response = await fetch('/api/prospects/import-public-records', { method: 'POST' });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Public-record import failed.');
      const sources = result?.sourceCounts
        ? ` (${result.sourceCounts.ghgrp} GHGRP records, ${result.sourceCounts.tri} TRI records; ${result.sourceCounts.triProfiles ?? 0} TRI profiles; ${result.sourceCounts.ghgrpEmissions ?? 0} reported-emissions matches before site merging)`
        : '';
      setNotice(`Public industrial pipeline refreshed: ${result.imported ?? 0} physical sites${sources}.`);
      await loadProspects();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Public-record import failed.');
    } finally {
      setImportingPublic(false);
    }
  }

  useEffect(() => {
    if (!initialPublicImportStarted && !demo && !all.some((prospect) => prospect.provider === 'public_pipeline')) {
      setInitialPublicImportStarted(true);
      void importPublicPipeline();
    }
  }, [all, demo, initialPublicImportStarted]);

  async function findProspects() {
    setSearching(true);
    try {
      const categoryResponse = await fetch('/api/dataforseo/categories');
      const categoryPayload = await categoryResponse.json().catch(() => null);
      const categories = Array.isArray(categoryPayload?.categories)
        ? categoryPayload.categories
          .filter((category: string) => /data center|cold storage|food processing|manufacturer|manufacturing|distribution|industrial/i.test(category))
          .sort((a: string, b: string) => {
            const rank = (value: string) => /data center|cold storage|food processing/i.test(value) ? 0 : /manufactur/i.test(value) ? 1 : /distribution/i.test(value) ? 2 : 3;
            return rank(a) - rank(b);
          })
          .slice(0, 10)
        : [];
      const response = await fetch('/api/prospects/search', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ centerLatitude: 40.8, centerLongitude: -77.8, radiusKm: 300, state: 'Pennsylvania', categories, limit: 250 }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Live search failed.');
      setNotice(`Search complete: ${result.imported ?? 0} facilities imported.`);
      await loadProspects();
    } catch (cause) {
      setNotice(cause instanceof Error ? cause.message : 'Unable to reach the prospect search service.');
    } finally {
      setSearching(false);
    }
  }

  function exportCsv() {
    const headers = [
      'Facility', 'Address', 'City', 'State', 'Postal code', 'Facility type', 'Pipeline tier', 'Microgrid score',
      'Industry and process fit - points', 'Industry and process fit - weight', 'Industry and process fit - value',
      'Reported operating scale - points', 'Reported operating scale - weight', 'Reported operating scale - value',
      'Physical site evidence - points', 'Physical site evidence - weight', 'Physical site evidence - value',
      'Outreach readiness - points', 'Outreach readiness - weight', 'Outreach readiness - value',
      'EPA Registry ID', 'EPA programs', 'Building area (sq ft)', 'Parent company / notes', 'Phone', 'Website',
    ];
    const rows = list.map((prospect) => {
      const profile = microgridProfile(prospect, scoreWeights);
      const signals = signalFor(prospect, scoreWeights);
      return [
        prospect.name, prospect.address, prospect.city, prospect.state, prospect.postal_code, label(prospect.facility_type), prospectSignalLabels[signals.tier], profile.score,
        profile.processPoints, scoreWeights.process, profile.processDetail,
        profile.operatingPoints, scoreWeights.operating, profile.operatingDetail,
        profile.scalePoints, scoreWeights.scale, profile.scaleDetail,
        profile.outreachPoints, scoreWeights.outreach, profile.outreachDetail,
        prospect.epa_frs_id, prospect.epa_programs?.join(', '), prospect.building_sqft, prospect.notes, prospect.phone, prospect.website,
      ].map(csvValue).join(',');
    });
    const csv = [headers.map(csvValue).join(','), ...rows].join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `gridswitch-prospects-${new Date().toISOString().slice(0, 10)}.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setNotice(`Exported ${list.length} filtered prospects with the current scoring weights.`);
  }

  async function researchOne(prospect: Prospect) {
    setResearchErrors((errors) => ({ ...errors, [prospect.id]: '' }));
    setResearchingIds((ids) => [...new Set([...ids, prospect.id])]);
    try {
      const response = await fetch(`/api/prospects/${prospect.id}/research`, { method: 'POST' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'AI research failed.');
      setAll((items) => items.map((item) => item.id === result.prospect.id ? result.prospect : item));
      setSelected((item) => item?.id === result.prospect.id ? result.prospect : item);
      return true;
    } catch (cause) {
      setResearchErrors((errors) => ({ ...errors, [prospect.id]: cause instanceof Error ? cause.message : 'AI research failed.' }));
      return false;
    } finally {
      setResearchingIds((ids) => ids.filter((id) => id !== prospect.id));
    }
  }

  async function researchTop3() {
    const candidates = list.filter((item) => item.ai_research_status !== 'complete').slice(0, 3);
    if (!candidates.length) {
      setNotice('The top filtered sites already have AI briefs.');
      return;
    }
    setNotice(`Adding concise AI opportunity briefs to ${candidates.length} priority sites...`);
    const results = await Promise.all(candidates.map(researchOne));
    setNotice(`AI briefs complete: ${results.filter(Boolean).length} succeeded, ${results.filter((result) => !result).length} failed.`);
  }

  const selectedSignals = selected ? signalFor(selected, scoreWeights) : null;
  const selectedProfile = selected ? microgridProfile(selected, scoreWeights) : null;
  const selectedPublicFacts = selected ? publicRecordFacts(selected) : [];
  const isResearching = selected ? researchingIds.includes(selected.id) : false;
  const selectedResearchError = selected ? researchErrors[selected.id] || selected.ai_error : null;
  const selectedAccount = useMemo(() => {
    if (!selected) return null;
    const parent = reportedParentCompany(selected);
    if (!parent) return null;
    const sites = all
      .filter((prospect) => reportedParentCompany(prospect)?.toLowerCase() === parent.toLowerCase())
      .sort((a, b) => signalFor(b, scoreWeights).score - signalFor(a, scoreWeights).score);
    const recommended = sites[0] ?? selected;
    return {
      parent,
      sites,
      recommended,
      prioritySites: sites.filter((prospect) => ['top_priority', 'priority_site'].includes(signalFor(prospect, scoreWeights).tier)).length,
      bestScore: signalFor(recommended, scoreWeights).score,
    };
  }, [all, selected, scoreWeights]);

  return (
    <main className={`min-h-screen ${darkMode ? 'dashboard-dark' : ''}`}>
      <nav className="border-b border-emerald-100 bg-white px-5 py-3 shadow-sm">
        <div className="mx-auto flex max-w-[1800px] items-center justify-between">
          <img className="h-11 w-auto" src="/gridswitch-logo.png" alt="GridSwitch" />
          <div className="flex items-center gap-2"><button className="control text-sm font-semibold" onClick={() => setDarkMode((enabled) => !enabled)}>{darkMode ? 'Light mode' : 'Dark mode'}</button>{demo && <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200">Demo data</span>}</div>
        </div>
      </nav>
      <div className="mx-auto max-w-[1800px] p-5 md:p-7">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-950 md:text-4xl">GridSwitch Prospecting Dashboard</h1>
          </div>
          <div className="flex flex-wrap gap-2"><button className="control border-emerald-200 font-semibold text-emerald-800" onClick={() => setScoreGuideMetric('all')}>Scorecard breakdown</button><button className="control border-emerald-200 font-semibold text-emerald-800" onClick={() => setShowWeights((open) => !open)}>{showWeights ? 'Close score settings' : 'Adjust score weights'}</button></div>
        </div>

        {showWeights && <section className="card mb-4 border-emerald-100 bg-emerald-50/50 p-4">
          <div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-slate-900">Choose what matters most</h2><p className="mt-1 text-sm text-slate-600">Weights change the order of this view only. They do not alter the underlying public data.</p></div><button className="text-sm font-semibold text-emerald-800 underline" onClick={() => setScoreWeights(DEFAULT_SCORE_WEIGHTS)}>Reset defaults</button></div>
          <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">{weightControls.map((item) => <label className="rounded-xl bg-white p-3 shadow-sm ring-1 ring-emerald-100" key={item.key}><span className="block text-sm font-semibold text-slate-900">{item.title}</span><span className="mt-1 block min-h-10 text-xs leading-4 text-slate-500">{item.help}</span><span className="mt-3 flex items-center gap-2"><input className="w-full accent-emerald-600" type="range" min="0" max="50" value={scoreWeights[item.key]} onChange={(event) => setScoreWeights((current) => ({ ...current, [item.key]: Number(event.target.value) }))} /><b className="w-10 text-right text-sm text-emerald-800">{scoreWeights[item.key]}</b></span></label>)}</div>
        </section>}

        <div className="card mb-4 flex flex-wrap gap-2 p-3 shadow-sm">
          <input className="control min-w-48 flex-1" placeholder="Search facility or address" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="control" value={city} onChange={(event) => setCity(event.target.value)}><option value="">All cities</option>{[...new Set(all.map((item) => item.city).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select>
          <select className="control" value={type} onChange={(event) => setType(event.target.value)}><option value="">All facility types</option>{[...new Set(all.map((item) => item.facility_type).filter(Boolean))].map((item) => <option key={item} value={item!}>{label(item)}</option>)}</select>
          <select className="control" value={tier} onChange={(event) => setTier(event.target.value)}><option value="">Ranked opportunities</option>{Object.entries(prospectSignalLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}</select>
          <label className="flex items-center gap-2 px-2 text-sm text-slate-600"><input type="checkbox" checked={showScreening} onChange={(event) => setShowScreening(event.target.checked)} /> Include unverified directory listings</label>
          <button className="control text-teal-800" disabled={importingPublic} onClick={importPublicPipeline}>{importingPublic ? 'Refreshing EPA data...' : 'Refresh EPA records & scores'}</button>
          <button className="control text-teal-800" disabled={researchingIds.length > 0} onClick={researchTop3}>{researchingIds.length ? `Researching ${researchingIds.length}...` : 'Add AI briefs to top 3'}</button>
          <button className="control border-emerald-200 font-semibold text-emerald-800" disabled={!list.length} onClick={exportCsv}>Export CSV</button>
          <button className="rounded bg-teal-700 px-4 text-sm text-white" disabled={searching} onClick={findProspects}>{searching ? 'Searching...' : 'Find Prospects'}</button>
        </div>
        {notice && <p className="mb-3 text-sm text-teal-800">{notice}</p>}

        <section className="card h-[400px] overflow-hidden shadow-sm md:h-[460px]"><ProspectMap prospects={list} selected={selected} onSelect={setSelected} weights={scoreWeights} /></section>
        <section className="card mt-4 overflow-auto shadow-sm">
            <table className="w-full">
              <thead className="sticky top-0 bg-white"><tr>{['Priority', 'Facility', 'Type', 'City', 'Primary score signal', 'Public sources', 'AI brief'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{list.map((prospect) => {
                const signals = signalFor(prospect, scoreWeights);
                const profile = microgridProfile(prospect, scoreWeights);
                return <tr className={`cursor-pointer hover:bg-slate-50 ${selected?.id === prospect.id ? 'bg-teal-50' : ''}`} key={prospect.id} onClick={() => setSelected(prospect)}>
                  <td className="min-w-40"><span className={`priority-pill rounded-full px-2 py-1 text-xs font-semibold ${tierStyle[signals.tier]}`}>{prospectSignalLabels[signals.tier]} · {signals.score}</span></td>
                  <td className="font-medium">{prospect.name}</td><td>{label(prospect.facility_type)}</td><td>{prospect.city}</td>
                  <td>{profile.reasons[0] || signals.evidenceFacts[0] || 'Public operating-site check pending'}</td>
                  <td>{signals.sourceNames.length ? signals.sourceNames.join(' · ') : 'Pending'}</td>
                  <td className="capitalize">{prospect.ai_research?.grid_switch_fit && prospect.ai_research.grid_switch_fit !== 'unknown' ? `${prospect.ai_research.grid_switch_fit} priority` : prospect.ai_research_status === 'failed' ? 'Failed' : researchingIds.includes(prospect.id) ? 'Researching...' : 'Not added'}</td>
                </tr>;
              })}</tbody>
            </table>
            {!list.length && <div className="p-8 text-center text-sm text-slate-600">No ranked industrial opportunities match these filters. Include unverified directory listings only when you want to review raw discovery leads.</div>}
          </section>

        {selected && selectedSignals && <aside className="fixed right-0 top-0 z-10 h-full w-[500px] overflow-auto bg-white p-6 shadow-2xl">
          <button className="float-right text-slate-500" onClick={() => setSelected(null)}>Close</button>
          <h2 className="pr-12 text-xl font-bold">{selected.name}</h2>
          <p className="mt-2"><span className={`priority-pill rounded-full px-2 py-1 text-xs font-semibold ${tierStyle[selectedSignals.tier]}`}>{prospectSignalLabels[selectedSignals.tier]} · {selectedSignals.score}/100</span></p>
          <p className="mt-4 text-sm">{selected.address}, {selected.city}, {selected.state} {selected.postal_code}</p>
          <section className="mt-6">
            <h3 className="font-semibold">Microgrid opportunity score</h3>
            <p className="mt-2 text-sm text-slate-700">{selectedSignals.summary}</p>
            {selectedProfile?.reasons.length ? <ul className="mt-3 space-y-2 text-sm">{selectedProfile.reasons.map((fact) => <li key={fact}>• {fact}</li>)}</ul> : null}
            {!selectedSignals.hasPublicEvidence && !selectedSignals.publicRecordsChecked && <p className="mt-3 text-sm text-slate-600">Public-source check pending.</p>}
          </section>
          <section className="mt-5 grid grid-cols-1 gap-3 text-sm text-slate-700">
            {selectedProfile && (() => {
              const profile = selectedProfile;
              return [
                { key: 'process' as const, detail: profile.processDetail, value: `${profile.processPoints}/${scoreWeights.process}` },
                { key: 'operating' as const, detail: profile.operatingDetail, value: `${profile.operatingPoints}/${scoreWeights.operating}` },
                { key: 'scale' as const, detail: profile.scaleDetail, value: `${profile.scalePoints}/${scoreWeights.scale}` },
                { key: 'outreach' as const, detail: profile.outreachDetail, value: `${profile.outreachPoints}/${scoreWeights.outreach}` },
              ].map((item) => { const guide = SCORE_METRIC_GUIDES[item.key]; return <button className="score-metric-card rounded-xl border border-slate-100 bg-slate-50 p-4 text-left" onClick={() => setScoreGuideMetric(item.key)} key={item.key}><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-slate-900">{guide.title}</div><p className="mt-1 text-xs text-slate-500">{guide.description}</p></div><b className="whitespace-nowrap text-emerald-800">{item.value}</b></div><div className="mt-3 border-t border-slate-200 pt-3 text-sm font-medium text-slate-700">{item.detail}</div><div className="mt-3 text-xs font-semibold text-emerald-700">View scoring rules →</div></button>; });
            })()}
          </section>
          {selectedProfile && <div className="mt-3 rounded-xl bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><b>Pipeline result:</b> {microgridFitLabels[selectedProfile.fit]}</div>}
          <p className="mt-3 text-xs text-slate-500">The score ranks disclosed industrial and commercial signals. It does not estimate a facility's electricity load or energy spend.</p>
          {selectedAccount && <section className="mt-5 rounded-xl border border-emerald-100 bg-emerald-50/50 p-4 text-sm text-slate-700">
            <h3 className="font-semibold text-slate-900">Parent-company opportunity</h3>
            <p className="mt-1 font-medium text-emerald-900">{selectedAccount.parent}</p>
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center"><div><dt className="text-xs text-slate-500">Sites found</dt><dd className="mt-1 font-semibold text-slate-900">{selectedAccount.sites.length}</dd></div><div><dt className="text-xs text-slate-500">Priority sites</dt><dd className="mt-1 font-semibold text-slate-900">{selectedAccount.prioritySites}</dd></div><div><dt className="text-xs text-slate-500">Best score</dt><dd className="mt-1 font-semibold text-slate-900">{selectedAccount.bestScore}/100</dd></div></dl>
            <p className="mt-3 text-xs text-slate-600">Recommended first site: <b>{selectedAccount.recommended.name}</b>{selectedAccount.recommended.city ? `, ${selectedAccount.recommended.city}` : ''}.</p>
          </section>}
          <section className="mt-5 rounded bg-slate-50 p-4 text-sm text-slate-700">
            <b className="text-slate-900">Recommended next step:</b>{' '}
            {selectedSignals.tier === 'top_priority'
              ? 'Contact facilities or operations leadership and ask about peak demand, expansion, resilience requirements, and outage cost.'
              : selectedSignals.tier === 'priority_site'
                ? 'Confirm peak demand, operating hours, and outage exposure before moving it into active outreach.'
                : selectedSignals.tier === 'industrial_lead'
                  ? 'Use the EPA record to verify the site, then qualify its process load and resilience need.'
                  : selectedSignals.tier === 'category_lead'
                    ? 'Research the operation before outreach; its category is promising but it lacks a corroborating facility record.'
                    : 'Keep in discovery only until a facility-specific operating signal is available.'}
          </section>
          {selectedPublicFacts.length > 0 && <section className="mt-6 border-t pt-5">
            <h3 className="font-semibold">Public record facts</h3>
            <ul className="mt-3 space-y-2 text-sm">{selectedPublicFacts.map((fact) => <li key={fact}>• {fact}</li>)}</ul>
          </section>}
          {selectedResearchError && <div role="alert" className="mt-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800"><b>AI brief did not run.</b><p className="mt-1">{selectedResearchError}</p></div>}
          {selected.ai_research && <AiResearch research={selected.ai_research} />}
          <div className="mt-6 flex flex-wrap gap-2">
            <button className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={isResearching} onClick={() => researchOne(selected)}>{isResearching ? 'Researching public sources...' : selectedResearchError ? 'Retry AI brief' : selected.ai_research ? 'Refresh AI brief' : 'Add AI brief'}</button>
            <button className="control" onClick={() => navigator.clipboard.writeText(`${selected.address}, ${selected.city}, ${selected.state}`)}>Copy address</button>
            {selected.phone && <span className="control cursor-default">Phone: {selected.phone}</span>}
            {selected.website && <a className="control" target="_blank" rel="noreferrer" href={selected.website}>Open website</a>}
          </div>
        </aside>}
        {scoreGuideMetric && <ScoreGuide metric={scoreGuideMetric} weights={scoreWeights} onClose={() => setScoreGuideMetric(null)} />}
      </div>
    </main>
  );
}
