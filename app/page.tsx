'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Prospect } from '@/lib/types';
import ProspectMap from '@/components/ProspectMap';

const label = (value: string | null | undefined) => value?.replaceAll('_', ' ') || 'Unknown';
const formatSqft = (value: number | null | undefined) => value ? `${Math.round(value).toLocaleString()} sq ft` : 'Unknown';

export default function Dashboard() {
  const [all, setAll] = useState<Prospect[]>([]);
  const [selected, setSelected] = useState<Prospect | null>(null);
  const [query, setQuery] = useState('');
  const [city, setCity] = useState('');
  const [type, setType] = useState('');
  const [minimum, setMinimum] = useState(0);
  const [status, setStatus] = useState('');
  const [demo, setDemo] = useState(false);
  const [searching, setSearching] = useState(false);
  const [notice, setNotice] = useState('');

  const loadProspects = useCallback(async () => {
    const response = await fetch('/api/prospects');
    const payload = await response.json();
    setAll(Array.isArray(payload.prospects) ? payload.prospects : []);
    setDemo(Boolean(payload.demo));
    if (payload.error) setNotice(payload.error);
  }, []);

  useEffect(() => { void loadProspects(); }, [loadProspects]);

  const list = useMemo(() => all.filter((prospect) => (
    (!city || prospect.city === city) &&
    (!type || prospect.facility_type === type) &&
    (!status || prospect.enrichment_status === status) &&
    (prospect.opportunity_score ?? 0) >= minimum &&
    `${prospect.name} ${prospect.address}`.toLowerCase().includes(query.toLowerCase())
  )).sort((a, b) => (b.opportunity_score ?? 0) - (a.opportunity_score ?? 0)), [all, city, type, status, minimum, query]);

  const totalSqft = list.reduce((sum, prospect) => sum + (prospect.building_sqft ?? 0), 0);
  const metrics: [string, string | number][] = [
    ['Total prospects', list.length], ['Enriched prospects', list.filter((item) => item.enrichment_status === 'complete').length],
    ['High-opportunity', list.filter((item) => (item.opportunity_score ?? 0) >= 70).length], ['Known building area', formatSqft(totalSqft)],
  ];

  async function findProspects() {
    setSearching(true);
    try {
      const response = await fetch('/api/prospects/search', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ centerLatitude: 40.8, centerLongitude: -77.8, radiusKm: 300, state: 'Pennsylvania', categories: ['industrial', 'manufacturing', 'warehouse'], limit: 250 }) });
      const result = await response.json();
      if (!response.ok) { setNotice(result.error || 'Live search failed. Review Vercel logs for details.'); return; }
      setNotice(`Search complete: ${result.imported ?? 0} imported, ${result.skipped ?? 0} skipped, ${result.failed ?? 0} failed.`);
      await loadProspects();
    } catch { setNotice('Unable to reach the prospect search service. Please try again.'); } finally { setSearching(false); }
  }

  return <main className="min-h-screen">
    <nav className="bg-[#101d29] text-white px-6 py-4 flex justify-between items-center"><div><b className="tracking-wide text-lg">GRIDSWITCH</b><span className="ml-3 text-sm text-slate-300">Prospecting Dashboard</span></div>{demo && <span className="rounded-full bg-slate-700 px-3 py-1 text-xs">Demo Data</span>}</nav>
    <div className="p-5 max-w-[1800px] mx-auto">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">{metrics.map(([title, value]) => <div className="card p-4" key={title}><div className="text-xs uppercase text-slate-500">{title}</div><div className="text-2xl font-bold mt-1">{value}</div></div>)}</div>
      <div className="card p-3 flex gap-2 flex-wrap mb-4">
        <input className="control flex-1 min-w-48" placeholder="Search facility or address" value={query} onChange={(event) => setQuery(event.target.value)} />
        <select className="control" value={city} onChange={(event) => setCity(event.target.value)}><option value="">All cities</option>{[...new Set(all.map((item) => item.city).filter(Boolean))].map((item) => <option key={item}>{item}</option>)}</select>
        <select className="control" value={type} onChange={(event) => setType(event.target.value)}><option value="">All facility types</option>{[...new Set(all.map((item) => item.facility_type).filter(Boolean))].map((item) => <option key={item} value={item!}>{label(item)}</option>)}</select>
        <select className="control" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Any enrichment</option><option>pending</option><option>partial</option><option>complete</option></select>
        <select className="control" value={minimum} onChange={(event) => setMinimum(+event.target.value)}><option value="0">Any score</option><option value="45">45+</option><option value="70">70+</option></select>
        <button className="bg-teal-700 text-white rounded px-4 text-sm" disabled={searching} onClick={findProspects}>{searching ? 'Searching…' : 'Find Prospects'}</button>
      </div>
      {notice && <p className="text-sm mb-3 text-teal-800">{notice}</p>}
      <div className="grid grid-cols-1 xl:grid-cols-[minmax(420px,1fr)_minmax(600px,1.2fr)] gap-4 h-[680px]">
        <section className="card overflow-hidden min-h-96"><ProspectMap prospects={list} selected={selected} onSelect={setSelected} /></section>
        <section className="card overflow-auto"><table className="w-full"><thead className="sticky top-0 bg-white"><tr>{['Score', 'Facility', 'Type', 'City', 'Building area', 'Acres', 'Enrichment', 'Status'].map((heading) => <th key={heading}>{heading}</th>)}</tr></thead><tbody>{list.map((prospect) => <tr className={`cursor-pointer hover:bg-slate-50 ${selected?.id === prospect.id ? 'bg-teal-50' : ''}`} key={prospect.id} onClick={() => setSelected(prospect)}><td><span className={`score ${(prospect.opportunity_score ?? 0) >= 70 ? 'score-high' : (prospect.opportunity_score ?? 0) >= 45 ? 'score-mid' : 'score-low'}`}>{prospect.opportunity_score}</span></td><td className="font-medium">{prospect.name}</td><td className="capitalize">{label(prospect.facility_type)}</td><td>{prospect.city}</td><td>{formatSqft(prospect.building_sqft)}</td><td>{prospect.parcel_acres ?? '—'}</td><td className="capitalize">{prospect.enrichment_status}</td><td className="capitalize">{prospect.prospect_status}</td></tr>)}</tbody></table></section>
      </div>
      {selected && <aside className="fixed right-0 top-0 h-full w-[390px] bg-white shadow-2xl p-6 overflow-auto z-10"><button className="float-right text-slate-500" onClick={() => setSelected(null)}>Close</button><h2 className="text-xl font-bold pr-12">{selected.name}</h2><p className="mt-2"><span className="score score-high">{selected.opportunity_score} Opportunity</span> <span className="capitalize text-slate-600">{label(selected.facility_type)}</span></p><p className="text-sm mt-4">{selected.address}, {selected.city}, {selected.state} {selected.postal_code}</p><dl className="grid grid-cols-2 gap-y-4 mt-6 text-sm">{[['Building area', formatSqft(selected.building_sqft)], ['Area source', selected.building_sqft_source || 'Unknown'], ['Parcel acres', selected.parcel_acres || 'Unknown'], ['Owner', selected.parcel_owner || 'Unknown'], ['Zoning', selected.zoning || 'Unknown'], ['Phone', selected.phone || 'Unknown'], ['Enrichment', selected.enrichment_status], ['Status', selected.prospect_status]].map(([title, value]) => <div key={String(title)}><dt className="text-slate-500">{title}</dt><dd className="font-medium capitalize">{value}</dd></div>)}</dl><p className="mt-5 text-xs text-slate-500">GridSwitch Opportunity Score is a preliminary heuristic based on facility type and known building area; it is not an electricity-use estimate.</p><div className="flex gap-2 mt-6"><button className="control" onClick={() => navigator.clipboard.writeText(`${selected.address}, ${selected.city}, ${selected.state}`)}>Copy address</button>{selected.website && <a className="control" target="_blank" rel="noreferrer" href={selected.website}>Open website</a>}</div></aside>}
    </div>
  </main>;
}
