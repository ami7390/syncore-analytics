"use client";
import { useEffect, useState } from "react";
type Site = { id: string; name: string; url: string };
type Provider = "ga4" | "search-console" | "clarity";
type ApiData = { data?: unknown; error?: string };
const providers: { id: Provider; label: string }[] = [{ id: "ga4", label: "Google Analytics 4" }, { id: "search-console", label: "Google Search Console" }, { id: "clarity", label: "Microsoft Clarity" }];
const number = (value: unknown) => typeof value === "number" ? value.toLocaleString("fr-FR") : Number(value ?? 0).toLocaleString("fr-FR");
export default function IntegrationsDashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [provider, setProvider] = useState<Provider>("ga4");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<unknown>(null);
  useEffect(() => {
    fetch("/api/admin/sites", { cache: "no-store" }).then(r => r.json()).then(v => {
      const rows: Site[] = Array.isArray(v.sites) ? v.sites : [];
      setSites(rows); setSiteId(current => current || rows[0]?.id || "");
    }).catch(() => setError("Impossible de charger les sites"));
  }, []);
  useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    fetch(`/api/integrations?siteId=${encodeURIComponent(siteId)}&provider=${provider}&days=${days}`, { cache: "no-store", signal: controller.signal })
      .then(async r => { const v: ApiData = await r.json(); if (!r.ok) throw new Error(v.error || "Erreur de récupération"); return v; })
      .then(v => setResult(v.data)).catch(e => { if (e.name !== "AbortError") setError(e.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, provider, days]);
  const data = result && typeof result === "object" ? result as Record<string, unknown> : null;
  const totals = data?.totals && typeof data.totals === "object" ? (data.totals as unknown[])[0] as { metricValues?: { value?: string }[] } | undefined : undefined;
  const rows = Array.isArray(data?.daily) ? data.daily as Record<string, unknown>[] : [];
  const queries = Array.isArray(data?.queries) ? data.queries as Record<string, unknown>[] : [];
  return <div style={{ display: "grid", gap: 20 }}>
    <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
      <label>Site<br/><select value={siteId} onChange={e => setSiteId(e.target.value)}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
      <label>Source<br/><select value={provider} onChange={e => setProvider(e.target.value as Provider)}>{providers.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}</select></label>
      <label>Période<br/><select value={days} onChange={e => setDays(Number(e.target.value))}><option value={7}>7 jours</option><option value={30}>30 jours</option><option value={90}>90 jours</option></select></label>
    </div>
    {loading && <p className="muted">Chargement des données…</p>}
    {error && <p role="alert" className="muted">{error}</p>}
    {provider === "ga4" && totals && <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>{["Utilisateurs actifs", "Sessions", "Vues de pages", "Conversions"].map((label, i) => <div key={label} style={{ padding: 16, border: "1px solid var(--line)", borderRadius: 12, minWidth: 145 }}><div className="muted">{label}</div><strong style={{ fontSize: 24 }}>{number(totals.metricValues?.[i]?.value)}</strong></div>)}</div>}
    {provider === "search-console" && queries.length > 0 && <div><h2>Principales recherches Google</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Requête</th><th>Clics</th><th>Impressions</th><th>CTR</th><th>Position</th></tr></thead><tbody>{queries.map((q,i) => <tr key={i}><td>{String((q.keys as string[])?.[0] ?? "")}</td><td>{number(q.clicks)}</td><td>{number(q.impressions)}</td><td>{(Number(q.ctr ?? 0)*100).toFixed(1)} %</td><td>{Number(q.position ?? 0).toFixed(1)}</td></tr>)}</tbody></table></div></div>}
    {rows.length > 0 && <div><h2>Évolution quotidienne</h2><div style={{ overflowX: "auto" }}><table style={{ width: "100%", textAlign: "left" }}><thead><tr><th>Date</th><th>{provider === "ga4" ? "Utilisateurs" : "Clics"}</th><th>{provider === "ga4" ? "Sessions" : "Impressions"}</th></tr></thead><tbody>{rows.map((r,i) => <tr key={i}><td>{String((r.dimensionValues as {value?:string}[])?.[0]?.value ?? (r.keys as string[])?.[0] ?? "")}</td><td>{number((r.metricValues as {value?:string}[])?.[0]?.value ?? r.clicks)}</td><td>{number((r.metricValues as {value?:string}[])?.[1]?.value ?? r.impressions)}</td></tr>)}</tbody></table></div></div>}
    {provider === "clarity" && data && <div><h2>Indicateurs Microsoft Clarity</h2><p className="muted">Données agrégées renvoyées par l’API Clarity (période disponible selon le fournisseur).</p><pre style={{ overflowX: "auto", whiteSpace: "pre-wrap", fontSize: 13 }}>{JSON.stringify(result, null, 2)}</pre></div>}
    {!loading && !error && !result && <p className="muted">Aucune donnée disponible.</p>}
  </div>;
}
