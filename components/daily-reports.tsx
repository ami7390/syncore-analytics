"use client";
import { useEffect, useState } from "react";
type Site = { id: string; name: string; url: string };
type Scores = { performance?: number | null; accessibility?: number | null; seo?: number | null; "best-practices"?: number | null };
type AuditResult = { scores?: Scores } | null;
type Journal = { id: string; title: string; status: string; category: string; details: string };
type Report = { id: string; site_id: string; report_date: string; generated_at: string; content: { audit: { total: number; completed: number; failed: number; pending: number; latest: { mobile?: AuditResult; desktop?: AuditResult } }; recommendations: { title: string; description: string; strategy: string }[]; journal: Journal[]; note: string } };
export default function DailyReports() {
 const [sites,setSites] = useState<Site[]>([]);
 const [reports,setReports] = useState<Report[]>([]);
 const [siteId,setSiteId] = useState("");
 const [error,setError] = useState("");
 const [loading,setLoading] = useState(true);
 useEffect(() => { let live = true; fetch("/api/admin/daily-reports", { cache: "no-store" }).then(async r => { const data = await r.json(); if (!r.ok) throw new Error(data.error ?? "Erreur de chargement"); return data; }).then(data => { if(live) { setSites(data.sites); setReports(data.reports); } }).catch(e => { if(live) setError(e instanceof Error ? e.message : "Erreur"); }).finally(() => { if(live) setLoading(false); }); return () => { live = false; }; }, []);
 const filtered = reports.filter(r => !siteId || r.site_id === siteId);
 const score = (value: number | null | undefined) => typeof value === "number" ? `${value}/100` : "Non mesuré";
 return <div style={{ display: "grid", gap: 20 }}>
  <div style={{ display: "flex", gap: 12, alignItems: "center", flexWrap: "wrap" }}><label htmlFor="report-site">Projet</label><select id="report-site" value={siteId} onChange={e => setSiteId(e.target.value)}><option value="">Tous les projets</option>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
  {loading && <p className="muted">Chargement des rapports…</p>}{error && <p role="alert">{error}</p>}
  {!loading && !error && filtered.length === 0 && <p className="muted">Aucun rapport quotidien enregistré. La génération automatique est programmée à 23 h 45 UTC.</p>}
  {filtered.map(r => { const site = sites.find(s => s.id === r.site_id); const a = r.content.audit; return <article className="panel" key={r.id} style={{ padding: 20, display: "grid", gap: 14 }}>
   <header><h2 style={{ margin: 0 }}>{site?.name ?? "Projet"} · {r.report_date}</h2><p className="muted" style={{ margin: "6px 0 0" }}>Généré le {new Date(r.generated_at).toLocaleString("fr-FR", { timeZone: "UTC" })} UTC</p></header>
   <p>Audits : {a.completed} réussi(s), {a.failed} échec(s), {a.pending} en attente sur {a.total} tentative(s).</p>
   <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>{(["mobile","desktop"] as const).map(strategy => { const s = a.latest?.[strategy]?.scores; return <section key={strategy} className="panel" style={{ padding: 14 }}><h3>{strategy === "mobile" ? "Mobile" : "Ordinateur"}</h3><p>Performance : {score(s?.performance)}</p><p>SEO : {score(s?.seo)}</p><p>Accessibilité : {score(s?.accessibility)}</p><p>Bonnes pratiques : {score(s?.["best-practices"])}</p></section>; })}</div>
   <section><h3>Améliorations recommandées ({r.content.recommendations?.length ?? 0})</h3>{r.content.recommendations?.length ? <ul>{r.content.recommendations.map((o,i) => <li key={i}><strong>{o.title}</strong> ({o.strategy})</li>)}</ul> : <p className="muted">Aucune recommandation enregistrée dans les audits disponibles.</p>}</section>
   <section><h3>Journal des interventions ({r.content.journal?.length ?? 0})</h3>{r.content.journal?.length ? <ul>{r.content.journal.map(j => <li key={j.id}><strong>{j.title}</strong> — {j.status}</li>)}</ul> : <p className="muted">Aucune intervention modifiée pendant cette journée.</p>}</section>
   <p className="muted" style={{ fontSize: 13 }}>{r.content.note}</p>
  </article>; })}
 </div>;
}
