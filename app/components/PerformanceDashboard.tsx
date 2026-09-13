'use client';

import { useMemo, useState } from 'react';

type Row = {
  query: string;
  page: string;
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
};

function parseNumber(value: string) {
  const cleaned = value.replace(/[%,$\s]/g, '').replace(/,/g, '');
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function normalizeHeader(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];
    if (char === '"' && quoted && next === '"') { cell += '"'; i += 1; continue; }
    if (char === '"') { quoted = !quoted; continue; }
    if (char === ',' && !quoted) { row.push(cell); cell = ''; continue; }
    if ((char === '\n' || char === '\r') && !quoted) {
      if (char === '\r' && next === '\n') i += 1;
      row.push(cell); cell = '';
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += char;
  }
  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

function parseGscCsv(text: string): Row[] {
  const matrix = parseCsv(text);
  if (matrix.length < 2) throw new Error('The CSV does not contain any data rows.');
  const headers = matrix[0].map(normalizeHeader);
  const find = (...names: string[]) => names.map((name) => headers.indexOf(name)).find((index) => index >= 0) ?? -1;
  const queryIndex = find('query', 'topqueries');
  const pageIndex = find('page', 'toppages', 'url');
  const clicksIndex = find('clicks');
  const impressionsIndex = find('impressions');
  const ctrIndex = find('ctr');
  const positionIndex = find('position', 'averageposition');
  if (clicksIndex < 0 || impressionsIndex < 0 || ctrIndex < 0 || positionIndex < 0) {
    throw new Error('Required columns not found. Export a Search Console Performance table containing Clicks, Impressions, CTR and Position.');
  }
  return matrix.slice(1).map((values) => {
    const impressions = parseNumber(values[impressionsIndex] ?? '0');
    const clicks = parseNumber(values[clicksIndex] ?? '0');
    const rawCtr = parseNumber(values[ctrIndex] ?? '0');
    const ctr = rawCtr > 1 ? rawCtr / 100 : rawCtr;
    return {
      query: queryIndex >= 0 ? (values[queryIndex] ?? '').trim() : '',
      page: pageIndex >= 0 ? (values[pageIndex] ?? '').trim() : '',
      clicks,
      impressions,
      ctr,
      position: parseNumber(values[positionIndex] ?? '0'),
    };
  }).filter((row) => row.impressions > 0 || row.clicks > 0);
}

function formatNumber(value: number) { return new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(value); }
function formatPercent(value: number) { return `${(value * 100).toFixed(1)}%`; }

export default function PerformanceDashboard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [error, setError] = useState('');
  const [fileName, setFileName] = useState('');
  const [sort, setSort] = useState<'impressions' | 'clicks' | 'ctr' | 'position'>('impressions');

  const summary = useMemo(() => {
    const impressions = rows.reduce((sum, row) => sum + row.impressions, 0);
    const clicks = rows.reduce((sum, row) => sum + row.clicks, 0);
    const ctr = impressions ? clicks / impressions : 0;
    const weightedPosition = impressions ? rows.reduce((sum, row) => sum + row.position * row.impressions, 0) / impressions : 0;
    return { impressions, clicks, ctr, position: weightedPosition };
  }, [rows]);

  const opportunities = useMemo(() => rows
    .filter((row) => row.query && row.impressions >= 10 && row.position >= 4 && row.position <= 20)
    .sort((a, b) => b.impressions - a.impressions)
    .slice(0, 8), [rows]);

  const sortedRows = useMemo(() => [...rows].sort((a, b) => {
    if (sort === 'position') return a.position - b.position;
    return b[sort] - a[sort];
  }).slice(0, 50), [rows, sort]);

  function handleFile(file: File | undefined) {
    if (!file) return;
    setError('');
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => {
      try { setRows(parseGscCsv(String(reader.result ?? ''))); }
      catch (err) { setRows([]); setError(err instanceof Error ? err.message : 'Could not read this CSV.'); }
    };
    reader.onerror = () => setError('Could not read this file.');
    reader.readAsText(file);
  }

  return <section className="performance-dashboard" aria-label="Search performance dashboard">
    <div className="performance-upload">
      <div><strong>1. Import Search Console data</strong><p>In Search Console, open Performance → Search results → Export → CSV, then choose the downloaded file.</p></div>
      <label className="performance-upload-button">Choose CSV<input type="file" accept=".csv,text/csv" onChange={(event) => handleFile(event.target.files?.[0])} /></label>
    </div>
    {fileName && <div className="performance-file">Loaded: <strong>{fileName}</strong> · {rows.length} rows</div>}
    {error && <div className="performance-error" role="alert">{error}</div>}

    {rows.length === 0 ? <div className="performance-empty"><strong>No Search Console data loaded yet.</strong><span>Nothing leaves your device. Once a CSV is loaded, the dashboard calculates metrics locally.</span></div> : <>
      <div className="performance-kpis">
        <div><span>Clicks</span><strong>{formatNumber(summary.clicks)}</strong></div>
        <div><span>Impressions</span><strong>{formatNumber(summary.impressions)}</strong></div>
        <div><span>CTR</span><strong>{formatPercent(summary.ctr)}</strong></div>
        <div><span>Avg. position</span><strong>{summary.position.toFixed(1)}</strong></div>
      </div>

      <div className="performance-section">
        <div className="performance-section-heading"><div><div className="eyebrow">Growth signals</div><h2>Ranking opportunities</h2></div><p>Queries with meaningful impressions ranking between positions 4–20 are useful candidates for better titles, stronger answers and internal links.</p></div>
        {opportunities.length ? <div className="performance-opportunities">{opportunities.map((row, index) => <div className="performance-opportunity" key={`${row.query}-${index}`}><strong>{row.query}</strong><span>{formatNumber(row.impressions)} impressions · {row.position.toFixed(1)} position · {formatPercent(row.ctr)} CTR</span></div>)}</div> : <div className="performance-empty compact"><strong>No clear opportunity found.</strong><span>More Search Console data will make this signal more useful.</span></div>}
      </div>

      <div className="performance-section">
        <div className="performance-section-heading"><div><div className="eyebrow">Top data</div><h2>Search performance</h2></div><select value={sort} onChange={(event) => setSort(event.target.value as typeof sort)} aria-label="Sort performance data"><option value="impressions">Impressions</option><option value="clicks">Clicks</option><option value="ctr">CTR</option><option value="position">Position</option></select></div>
        <div className="performance-table-wrap"><table className="performance-table"><thead><tr><th>Query / page</th><th>Clicks</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>{sortedRows.map((row, index) => <tr key={`${row.query}-${row.page}-${index}`}><td><strong>{row.query || row.page || 'Unknown'}</strong>{row.query && row.page && <small>{row.page}</small>}</td><td>{formatNumber(row.clicks)}</td><td>{formatNumber(row.impressions)}</td><td>{formatPercent(row.ctr)}</td><td>{row.position.toFixed(1)}</td></tr>)}</tbody></table></div>
      </div>
    </>}
  </section>;
}
