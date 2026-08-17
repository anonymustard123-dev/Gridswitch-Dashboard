'use client';

import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEffect, useRef } from 'react';
import type { Prospect } from '@/lib/types';

function featureCollection(prospects: Prospect[]): GeoJSON.FeatureCollection {
  return {
    type: 'FeatureCollection',
    features: prospects
      .filter((prospect) => prospect.latitude != null && prospect.longitude != null)
      .map((prospect) => ({
        type: 'Feature' as const,
        properties: { id: prospect.id, score: prospect.opportunity_score ?? 0 },
        geometry: { type: 'Point' as const, coordinates: [prospect.longitude!, prospect.latitude!] },
      })),
  };
}

export default function ProspectMap({ prospects, onSelect, selected }: { prospects: Prospect[]; onSelect: (prospect: Prospect) => void; selected?: Prospect | null }) {
  const node = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const prospectsRef = useRef(prospects);
  prospectsRef.current = prospects;
  const valid = prospects.filter((prospect) => prospect.latitude != null && prospect.longitude != null);

  useEffect(() => {
    if (!node.current || map.current || !process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return;
    mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN;
    const instance = (map.current = new mapboxgl.Map({ container: node.current, style: 'mapbox://styles/mapbox/light-v11', center: [-77.7, 40.8], zoom: 6 }));
    instance.addControl(new mapboxgl.NavigationControl());
    instance.addControl(new mapboxgl.FullscreenControl());
    instance.on('load', () => {
      instance.addSource('facilities', { type: 'geojson', data: featureCollection(prospectsRef.current), cluster: true, clusterMaxZoom: 14, clusterRadius: 45 });
      instance.addLayer({ id: 'clusters', type: 'circle', source: 'facilities', filter: ['has', 'point_count'], paint: { 'circle-color': '#0f766e', 'circle-radius': ['step', ['get', 'point_count'], 18, 10, 23, 30, 28] } });
      instance.addLayer({ id: 'cluster-count', type: 'symbol', source: 'facilities', filter: ['has', 'point_count'], layout: { 'text-field': '{point_count_abbreviated}', 'text-size': 12 }, paint: { 'text-color': '#fff' } });
      instance.addLayer({ id: 'points', type: 'circle', source: 'facilities', filter: ['!', ['has', 'point_count']], paint: { 'circle-radius': 7, 'circle-color': ['step', ['get', 'score'], '#94a3b8', 45, '#f59e0b', 70, '#16a34a'], 'circle-stroke-width': 1, 'circle-stroke-color': '#fff' } });
      instance.on('click', 'clusters', (event) => {
        const feature = instance.queryRenderedFeatures(event.point, { layers: ['clusters'] })[0];
        const clusterId = feature?.properties?.cluster_id;
        if (clusterId == null) return;
        (instance.getSource('facilities') as mapboxgl.GeoJSONSource).getClusterExpansionZoom(clusterId, (error, zoom) => {
          if (!error && typeof zoom === 'number') instance.easeTo({ center: (feature.geometry as GeoJSON.Point).coordinates as [number, number], zoom });
        });
      });
      instance.on('click', 'points', (event) => {
        const id = event.features?.[0]?.properties?.id;
        const prospect = prospectsRef.current.find((item) => item.id === id);
        if (prospect) onSelect(prospect);
      });
    });
    return () => { instance.remove(); map.current = null; };
  }, [onSelect]);

  useEffect(() => {
    const instance = map.current;
    const source = instance?.getSource('facilities') as mapboxgl.GeoJSONSource | undefined;
    if (!source) return;
    source.setData(featureCollection(prospects));
    if (valid.length) {
      const bounds = new mapboxgl.LngLatBounds();
      valid.forEach((prospect) => bounds.extend([prospect.longitude!, prospect.latitude!]));
      instance?.fitBounds(bounds, { padding: 40, maxZoom: 11, duration: 600 });
    }
  }, [prospects]);

  useEffect(() => { if (selected?.longitude != null && selected.latitude != null) map.current?.flyTo({ center: [selected.longitude, selected.latitude], zoom: 13 }); }, [selected]);
  if (!process.env.NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN) return <div className="h-full grid place-items-center text-center p-8 text-slate-500">Mapbox token not configured.<br /><small>Add NEXT_PUBLIC_MAPBOX_ACCESS_TOKEN to show the interactive map.</small></div>;
  if (!valid.length) return <div className="h-full grid place-items-center text-slate-500">No filtered facilities have valid coordinates.</div>;
  return <div ref={node} className="h-full w-full" />;
}
