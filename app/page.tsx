'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import ProspectMap from '@/components/ProspectMap';
import {
  prospectSignalLabels,
  prospectSignals,
  type ProspectSignalTier,
} from '@/lib/prospect-signals';
import type { AiFacilityResearch, AiQualificationSignal, Prospect } from '@/lib/types';

const label = (value: string | null | undefined) =>
  value?.replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase()) || 'Unknown';
const signalFor = (prospect: Prospect) => prospectSignals(prospect);

const tierStyle: Record<ProspectSignalTier, string> = {
  priority_category: 'bg-emerald-100 text-emerald-800',
  possible_fit: 'bg-amber-100 text-amber-800',
  unqualified_listing: 'bg-slate-200 text-slate-700',
};
const fitStyle: Record<string, string> = {
  high: 'bg-emerald-100 text-emerald-800',
  moderate: 'bg-amber-100 text-amber-800',
  low: 'bg-slate-200 text-slate-700',
  unknown: 'bg-slate-100 text-slate-600',
};
const qualificationLabels: Record<string, string> = {
  load_intensity: 'Large / continuous load',
  uptime_criticality: 'Uptime criticality',
  resilience_need: 'Resilience need',
  expansion_or_capex: 'Expansion / capital window',
  onsite_energy_assets: 'Existing energy assets',
};

function QualificationRow({ name, signal }: { name: string; signal: AiQualificationSignal }) {
  return (
    <div className="rounded border border-slate-200 p-3">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium">{qualificationLabels[name]}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold capitalize ${fitStyle[signal.rating]}`}>
          {signal.rating}
        </span>
      </div>
      <p className="mt-2 text-sm text-slate-600">{signal.evidence}</p>
      {signal.source_url && (
        <a className="mt-2 inline-block text-xs text-teal-700 underline" href={signal.source_url} target="_blank" rel="noreferrer">
          Supporting source
        </a>
      )}
    </div>
  );
}

function AiResearch({ research }: { research: AiFacilityResearch }) {
  return (
    <section className="mt-6 border-t pt-5">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">Microgrid qualification research</h3>
        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${fitStyle[research.grid_switch_fit]}`}>
          {research.grid_switch_fit} fit
        </span>
      </div>
      <p className="mt-3 text-sm">{research.facility_summary}</p>

      {research.qualification && (
        <div className="mt-4 grid gap-2">
          {Object.entries(research.qualification).map(([name, signal]) => (
            <QualificationRow key={name} name={name} signal={signal} />
          ))}
        </div>
      )}

      <div className="mt-4 rounded bg-slate-900 p-3 text-sm text-white">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Recommended next action</div>
        <div className="mt-1 font-semibold">{label(research.recommended_action)}</div>
        <p className="mt-1 text-slate-200">{research.recommended_action_reason}</p>
      </div>

      <h4 className="mt-4 text-sm font-semibold">Outreach angle</h4>
      <p className="mt-1 text-sm">{research.outreach_angle}</p>
      {research.target_roles?.length > 0 && (
        <p className="mt-2 text-sm text-slate-600">
          <b>Target roles:</b> {research.target_roles.join(', ')}
        </p>
      )}

      <h4 className="mt-4 text-sm font-semibold">Questions that determine real fit</h4>
      <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">
        {research.discovery_questions.map((question) => <li key={question}>{question}</li>)}
      </ul>

      {research.disqualifiers?.length > 0 && (
        <>
          <h4 className="mt-4 text-sm font-semibold">Potential disqualifiers</h4>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-600">
            {research.disqualifiers.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </>
      )}
    </section>
  );
}

export default function Dashboard() {
  const [all, setAll] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [tier, setTier] = useState('');
  const [demo, setDemo] = useState(false);
  const [searching, setSearching] = useState(false);
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
        (!tier || signalFor(prospect).tier === tier) &&
        `${prospect.name} ${prospect.address}`.toLowerCase().includes(query.toLowerCase()))
      .sort((a, b) => signalFor(b).score - signalFor(a).score),
    [all, city, type, tier, query],
  );

  const metrics: [string, string | number][] = [
    ['Discovered facilities', list.length],
    ['Priority facility types', list.filter((item) => signalFor(item).tier === 'priority_category').length],
    ['AI researched', list.filter((item) => item.ai_research_status === 'complete').length],
    ['Research-supported fit', list.filter((item) => ['high', 'moderate'].includes(item.ai_research?.grid_switch_fit ?? '')).length],
  ];

  async function findProspects() {
    setSearching(true);
    try {
      const response = await fetch('/api/prospects/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          centerLatitude: 40.8,
          centerLongitude: -77.8,
          radiusKm: 300,
          state: 'Pennsylvania',
          categories: ['industrial', 'manufacturing', 'warehouse'],
          limit: 250,
        }),
      });
      const result = await response.json();
      if (!response.ok) {
        setNotice(result.error || 'Live search failed.');
        return;
      }
      setNotice(`Search complete: ${result.imported ?? 0} imported. These are discovery candidates, not qualified microgrid projects.`);
      await loadProspects();
    } catch {
      setNotice('Unable to reach the prospect search service.');
    } finally {
      setSearching(false);
    }
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
      const message = cause instanceof Error ? cause.message : 'AI research failed.';
      setResearchErrors((errors) => ({ ...errors, [prospect.id]: message }));
      return false;
    } finally {
      setResearchingIds((ids) => ids.filter((id) => id !== prospect.id));
    }
  }

  async function researchTop3() {
    const candidates = list
      .filter((item) => item.ai_research_status !== 'complete')
      .slice(0, 3);
    if (!candidates.length) {
      setNotice('The top filtered prospects have already been researched.');
      return;
    }
    setNotice(`Researching ${candidates.length} facilities for microgrid-specific evidence...`);
    const results = await Promise.all(candidates.map(researchOne));
    setNotice(`Research complete: ${results.filter(Boolean).length} succeeded, ${results.filter((result) => !result).length} failed.`);
  }

  const selectedSignals = selected ? signalFor(selected) : null;
  const isResearching = selected ? researchingIds.includes(selected.id) : false;
  const selectedResearchError = selected ? researchErrors[selected.id] || selected.ai_error : null;

  return (
    <main className="min-h-screen">
      <nav className="flex items-center justify-between bg-[#101d29] px-6 py-4 text-white">
        <div><b className="text-lg tracking-wide">GRIDSWITCH</b><span className="ml-3 text-sm text-slate-300">Prospecting Dashboard</span></div>
        {demo && <span className="rounded-full bg-slate-700 px-3 py-1 text-xs">Demo Data</span>}
      </nav>
      <div className="mx-auto max-w-[1800px] p-5">
        <div className="mb-4">
          <h1 className="text-xl font-bold">Find sites, then qualify the microgrid case</h1>
          <p className="mt-1 text-sm text-slate-600">
            DataForSEO discovers physical facilities. Facility type provides an initial hypothesis; only cited research or a discovery call can establish load, resilience need, and buying timing.
          </p>
        </div>

        <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map(([title, value]) => (
            <div className="card p-4" key={title}>
              <div className="text-xs uppercase text-slate-500">{title}</div>
              <div className="mt-1 text-2xl font-bold">{value}</div>
            </div>
          ))}
        </div>

        <div className="card mb-4 flex flex-wrap gap-2 p-3">
          <input className="control min-w-48 flex-1" placeholder="Search facility or address" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="control" value={city} onChange={(event) => setCity(event.target.value)}>
            <option value="">All cities</option>
            {[...new Set(all.map((item) => item.city).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}
          </select>
          <select className="control" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">All facility types</option>
            {[...new Set(all.map((item) => item.facility_type).filter(Boolean))].map((item) => <option key={item} value={item!}>{label(item)}</option>)}
          </select>
          <select className="control" value={tier} onChange={(event) => setTier(event.target.value)}>
            <option value="">All discovery stages</option>
            {Object.entries(prospectSignalLabels).map(([value, text]) => <option key={value} value={value}>{text}</option>)}
          </select>
          <button className="control text-teal-800" disabled={researchingIds.length > 0} onClick={researchTop3}>
            {researchingIds.length ? `Researching ${researchingIds.length}...` : 'Research top 3'}
          </button>
          <button className="rounded bg-teal-700 px-4 text-sm text-white" disabled={searching} onClick={findProspects}>
            {searching ? 'Searching...' : 'Find Prospects'}
          </button>
        </div>
        {notice && <p className="mb-3 text-sm text-teal-800">{notice}</p>}

        <div className="grid h-[680px] grid-cols-1 gap-4 xl:grid-cols-[minmax(420px,1fr)_minmax(600px,1.2fr)]">
          <section className="card min-h-96 overflow-hidden">
            <ProspectMap prospects={list} selected={selected} onSelect={setSelected} />
          </section>
          <section className="card overflow-auto">
            <table className="w-full">
              <thead className="sticky top-0 bg-white"><tr>{['Discovery stage', 'Facility', 'Type', 'City', 'Microgrid hypothesis', 'AI evidence', 'Contact'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead>
              <tbody>{list.map((prospect) => {
                const signals = signalFor(prospect);
                return (
                  <tr className={`cursor-pointer hover:bg-slate-50 ${selected?.id === prospect.id ? 'bg-teal-50' : ''}`} key={prospect.id} onClick={() => setSelected(prospect)}>
                    <td><span className={`rounded-full px-2 py-1 text-xs font-semibold ${tierStyle[signals.tier]}`}>{prospectSignalLabels[signals.tier]}</span></td>
                    <td className="font-medium">{prospect.name}</td>
                    <td>{label(prospect.facility_type)}</td>
                    <td>{prospect.city}</td>
                    <td>{signals.relevanceReasons[0] || 'No load or resilience evidence yet'}</td>
                    <td className="capitalize">{prospect.ai_research?.grid_switch_fit ? `${prospect.ai_research.grid_switch_fit} fit` : prospect.ai_research_status === 'failed' ? 'Failed' : researchingIds.includes(prospect.id) ? 'Researching...' : 'Not researched'}</td>
                    <td>{prospect.phone && prospect.website ? 'Phone + site' : prospect.phone ? 'Phone' : prospect.website ? 'Website' : 'Unavailable'}</td>
                  </tr>
                );
              })}</tbody>
            </table>
          </section>
        </div>

        {selected && selectedSignals && (
          <aside className="fixed right-0 top-0 z-10 h-full w-[500px] overflow-auto bg-white p-6 shadow-2xl">
            <button className="float-right text-slate-500" onClick={() => setSelected(null)}>Close</button>
            <h2 className="pr-12 text-xl font-bold">{selected.name}</h2>
            <p className="mt-2">
              <span className={`rounded-full px-2 py-1 text-xs font-semibold ${tierStyle[selectedSignals.tier]}`}>{prospectSignalLabels[selectedSignals.tier]}</span>
              {!selected.ai_research && <span className="ml-2 text-sm font-medium text-slate-600">Not microgrid-qualified</span>}
            </p>
            <p className="mt-4 text-sm">{selected.address}, {selected.city}, {selected.state} {selected.postal_code}</p>

            <section className="mt-6">
              <h3 className="font-semibold">Why it may be relevant</h3>
              {selectedSignals.relevanceReasons.length ? (
                <ul className="mt-3 space-y-2 text-sm">{selectedSignals.relevanceReasons.map((reason) => <li key={reason} className="flex gap-2"><span className="text-teal-700">●</span>{reason}</li>)}</ul>
              ) : <p className="mt-2 text-sm text-slate-600">The directory record contains no meaningful microgrid evidence yet.</p>}
            </section>

            <section className="mt-6 rounded bg-slate-50 p-4">
              <h3 className="font-semibold">What the directory actually proves</h3>
              <ul className="mt-3 space-y-2 text-sm text-slate-700">{selectedSignals.directoryFacts.map((fact) => <li key={fact}>• {fact}</li>)}</ul>
              <p className="mt-3 text-xs text-slate-500">These facts help locate and contact a site. They do not prove a large electric load or a viable microgrid project.</p>
            </section>

            {!selected.ai_research && (
              <section className="mt-6">
                <h3 className="font-semibold">Still required to qualify this site</h3>
                <ul className="mt-3 space-y-2 text-sm">{selectedSignals.unknowns.map((unknown) => <li key={unknown} className="flex gap-2"><span className="text-amber-600">○</span>{unknown}</li>)}</ul>
              </section>
            )}

            {selectedResearchError && (
              <div role="alert" className="mt-5 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                <b>Research did not run.</b>
                <p className="mt-1">{selectedResearchError}</p>
              </div>
            )}

            {selected.ai_research && <AiResearch research={selected.ai_research} />}

            <div className="mt-6 flex flex-wrap gap-2">
              <button className="rounded bg-teal-700 px-3 py-2 text-sm text-white disabled:opacity-60" disabled={isResearching} onClick={() => researchOne(selected)}>
                {isResearching ? 'Researching public sources...' : selectedResearchError ? 'Retry research' : selected.ai_research ? 'Refresh research' : 'Qualify with web research'}
              </button>
              <button className="control" onClick={() => navigator.clipboard.writeText(`${selected.address}, ${selected.city}, ${selected.state}`)}>Copy address</button>
              {selected.phone && <a className="control" href={`tel:${selected.phone}`}>Call facility</a>}
              {selected.website && <a className="control" target="_blank" rel="noreferrer" href={selected.website}>Open website</a>}
            </div>
          </aside>
        )}
      </div>
    </main>
  );
}
