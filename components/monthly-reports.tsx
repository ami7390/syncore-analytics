"use client";

import { useCallback, useEffect, useState } from "react";
import { jsPDF } from "jspdf";

type Site = { id: string; name: string; url: string };
type Report = { id: string; site_id: string; report_month: string; description: string; snapshot: unknown; status: "draft" | "published"; captured_at: string; published_at: string | null };
type ResponseData = { sites?: Site[]; reports?: Report[]; error?: string };
const obj = (v: unknown): Record<string, unknown> => v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {};
const arr = (v: unknown): unknown[] => Array.isArray(v) ? v : [];
const str = (v: unknown) => typeof v === "string" ? v : String(v ?? "");
const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : null;
const currentMonth = () => new Date().toISOString().slice(0, 7);

function makePdf(report: Report, site: Site | undefined) {
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const pageW = 210, margin = 19, max = pageW - 2 * margin;
  let y = 24;
  const ensure = (height: number) => { if (y + height > 274) { pdf.addPage(); y = 22; } };
  const heading = (title: string) => { ensure(18); y += 6; pdf.setFont("helvetica", "bold"); pdf.setFontSize(13); pdf.setTextColor(24, 49, 87); pdf.text(title, margin, y); y += 9; };
  const line = (text: string) => {
    pdf.setFont("helvetica", "normal"); pdf.setFontSize(10); pdf.setTextColor(44, 54, 70);
    const lines = pdf.splitTextToSize(text || "Non disponible", max) as string[];
    for (const item of lines) { ensure(5.2); pdf.text(item, margin, y); y += 5.2; }
    y += 2;
  };
  pdf.setFillColor(24, 49, 87); pdf.rect(0, 0, 210, 12, "F");
  pdf.setFont("helvetica", "bold"); pdf.setTextColor(24, 49, 87); pdf.setFontSize(20);
  pdf.text("SYNCORE ANALYTICS", margin, y); y += 11;
  pdf.setFontSize(15); pdf.text("Bilan mensuel de direction", margin, y); y += 10;
  line(`Site : ${site?.name ?? report.site_id} - ${site?.url ?? ""}`);
  line(`Mois : ${report.report_month} | Capture : ${new Date(report.captured_at).toLocaleString("fr-FR")} | Publication : ${report.published_at ? new Date(report.published_at).toLocaleDateString("fr-FR") : "Brouillon"}`);
  const snap = obj(report.snapshot);
  const windows = obj(snap.windows);
  heading("Synthese et ameliorations realisees");
  line(report.description);
  heading("Google Analytics 4 - 30 derniers jours a la capture");
  const integrations = obj(snap.integrations);
  const ga = obj(integrations.ga4);
  if (ga.error) line(`Indisponible : ${str(ga.error)}`);
  else {
    const data = obj(ga.data);
    const totals = obj(arr(data.totals)[0]);
    const metrics = arr(totals.metricValues);
    const labels = ["Visiteurs actifs", "Sessions", "Pages consultees", "Conversions"];
    if (!metrics.length) line("Aucun total disponible.");
    else metrics.slice(0, 4).forEach((v, i) => line(`${labels[i]} : ${str(obj(v).value)}`));
  }
  heading("Google Search Console - 30 derniers jours a la capture");
  const gsc = obj(integrations.gsc);
  if (gsc.error) line(`Indisponible : ${str(gsc.error)}`);
  else {
    const data = obj(gsc.data);
    const rows = arr(data.daily);
   const clicks = rows.reduce<number>(
  (a, r) => a + (num(obj(r).clicks) ?? 0),
  0
);

const impressions = rows.reduce<number>(
  (a, r) => a + (num(obj(r).impressions) ?? 0),
  0
);
    if (!rows.length) line("Aucune donnee quotidienne disponible.");
    else { line(`Clics : ${clicks}`); line(`Impressions : ${impressions}`); line(`CTR : ${impressions ? (100 * clicks / impressions).toFixed(2) : "N/D"} %`); }
  }
  heading("Microsoft Clarity - 3 derniers jours a la capture");
  const clarity = obj(integrations.clarity);
  if (clarity.error) line(`Indisponible : ${str(clarity.error)}`);
  else {
    const sections = arr(clarity.data);
    if (!sections.length) line("Aucune donnee disponible.");
    else sections.slice(0, 12).forEach(s => {
      const section = obj(s);
      const name = str(section.metricName || section.name || "Indicateur");
      const info = arr(section.information);
      const first = obj(info[0]);
      const values = Object.entries(first).filter(([k, v]) => k !== "url" && ["string", "number"].includes(typeof v)).slice(0, 3).map(([k, v]) => `${k}: ${str(v)}`);
      line(`${name} : ${values.length ? values.join(" | ") : "Voir le tableau Clarity"}`);
    });
  }
  heading("Lighthouse - audits du mois");
  const audits = arr(snap.lighthouse);
  if (!audits.length) line("Aucun audit quotidien disponible pour ce mois.");
  else {
    const scores = (strategy: "mobile" | "desktop") => audits.map(a => {
      const content = obj(obj(a).content);
      const latest = obj(obj(content.audit).latest);
      const metrics = obj(obj(latest[strategy]).scores);
      return num(metrics.performance);
    }).filter((v): v is number => v !== null);
    for (const strategy of ["mobile", "desktop"] as const) {
      const values = scores(strategy);
      line(`${strategy === "mobile" ? "Mobile" : "Ordinateur"} : ${values.length ? `${Math.round(values.reduce((a, b) => a + b, 0) / values.length)}/100 (moyenne de ${values.length} audits)` : "N/D"}`);
    }
  }
  heading("Interventions terminees pendant le mois");
  const interventions = arr(snap.interventions);
  if (!interventions.length) line("Aucune intervention terminee enregistree pour ce mois.");
  interventions.forEach(item => { const entry = obj(item); line(`${str(entry.completed_at).slice(0, 10)} - ${str(entry.title)}`); if (entry.details) line(str(entry.details)); });
  heading("Perimetre et interpretation");
  line(`GA4 : ${str(windows.ga4)}. GSC : ${str(windows.gsc)}. Clarity : ${str(windows.clarity)}.`);
  line("Les fenetres GA4, GSC et Clarity sont glissantes a la date de capture ; elles ne correspondent pas necessairement au mois civil du rapport. Les scores Lighthouse sont des mesures de laboratoire et peuvent varier.");
  const pages = pdf.getNumberOfPages();
  for (let i = 1; i <= pages; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(125, 132, 143); pdf.text(`Syncore Analytics - ${report.report_month} - ${i}/${pages}`, margin, 288); }
  pdf.save(`syncore-bilan-${report.report_month}-${(site?.name ?? "site").toLowerCase().replace(/[^a-z0-9]+/g, "-")}.pdf`);
}

export default function MonthlyReports({ owner }: { owner: boolean }) {
  const [data, setData] = useState<ResponseData>({});
  const [siteId, setSiteId] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    const response = await fetch("/api/monthly-reports", { cache: "no-store" });
    const json = await response.json() as ResponseData;
    setData(json);
    setSiteId(prev => prev || json.sites?.[0]?.id || "");
  }, []);
  useEffect(() => { void refresh().catch(() => setMessage("Chargement impossible")); }, [refresh]);
  const capture = async () => {
    if (!siteId || !description.trim()) { setMessage("Sélectionne un site et décris les améliorations réalisées."); return; }
    setBusy(true); setMessage("");
    try {
      const integrations: Record<string, unknown> = {};
      for (const [key, provider] of [["ga4", "ga4"], ["gsc", "search-console"], ["clarity", "clarity"]]) {
        try {
          const res = await fetch(`/api/integrations?siteId=${encodeURIComponent(siteId)}&provider=${provider}&days=30`, { cache: "no-store" });
          const body = await res.json();
          integrations[key] = res.ok ? { data: body.data, capturedAt: new Date().toISOString() } : { error: body.error ?? "Indisponible" };
        } catch { integrations[key] = { error: "Indisponible" }; }
      }
      const res = await fetch("/api/monthly-reports", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, month: currentMonth(), description, integrations }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Enregistrement impossible");
      setMessage("Brouillon enregistré. Vérifie le PDF avant publication.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur inconnue"); }
    finally { setBusy(false); }
  };
  const publish = async (id: string) => {
    if (!window.confirm("Publier définitivement ce rapport pour le Directeur ?")) return;
    setBusy(true);
    try {
      const res = await fetch("/api/monthly-reports", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id }) });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Publication impossible");
      setMessage("Rapport publié : le Directeur peut maintenant le consulter.");
      await refresh();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur inconnue"); }
    finally { setBusy(false); }
  };
  return <section className="panel" style={{ marginTop: 24 }}>
    <h2>Rapports mensuels PDF</h2>
    <p className="muted">GA4 et GSC : 30 derniers jours à la capture · Clarity : 3 derniers jours · Lighthouse et interventions : mois civil. Seuls les rapports publiés sont visibles par le Directeur.</p>
    {owner && <div style={{ display: "grid", gap: 12, marginBottom: 24 }}>
      <h3>Préparer un bilan — {currentMonth()}</h3>
      <label htmlFor="monthly-site">Projet</label>
      <select id="monthly-site" className="input" value={siteId} onChange={e => setSiteId(e.target.value)}>{(data.sites ?? []).map(site => <option value={site.id} key={site.id}>{site.name}</option>)}</select>
      <label htmlFor="monthly-description">Améliorations et corrections réalisées pendant le mois</label>
      <textarea id="monthly-description" className="input" rows={6} maxLength={10000} value={description} onChange={e => setDescription(e.target.value)} placeholder="Décris les interventions, les corrections et les résultats observés…" />
      <div><button type="button" className="btn" disabled={busy || !siteId} onClick={() => void capture()}>{busy ? "Traitement…" : "Enregistrer le brouillon et capturer les résultats"}</button></div>
    </div>}
    {message && <p role="status">{message}</p>}
    {data.error && <p className="error">{data.error}</p>}
    <h3>Historique des rapports</h3>
    {(data.reports ?? []).length === 0 && <p className="muted">Aucun rapport disponible pour le moment.</p>}
    <div style={{ display: "grid", gap: 12 }}>
      {(data.reports ?? []).map(report => <article key={report.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: 16 }}>
        <strong>{data.sites?.find(s => s.id === report.site_id)?.name ?? "Projet"} — {report.report_month}</strong>
        <p className="muted" style={{ margin: "6px 0 12px" }}>{report.status === "published" ? "Publié" : "Brouillon privé"} · Capture : {new Date(report.captured_at).toLocaleDateString("fr-FR")}</p>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10 }}>
          <button type="button" className="btn" onClick={() => makePdf(report, data.sites?.find(s => s.id === report.site_id))}>Télécharger le PDF</button>
          {owner && report.status === "draft" && <button type="button" className="btn" disabled={busy} onClick={() => void publish(report.id)}>Publier pour le Directeur</button>}
        </div>
      </article>)}
    </div>
  </section>;
}
