"use client";

import { useEffect, useMemo, useState } from "react";

type Site = { id: string; name: string; url: string };
type Provider = "ga4" | "search-console" | "clarity";
type ApiData = { data?: unknown; error?: string };
type RecordValue = Record<string, unknown>;

const providers: { id: Provider; label: string; short: string; description: string }[] = [
  { id: "ga4", label: "Google Analytics 4 (GA4)", short: "Google Analytics 4 (GA4)", description: "Fréquentation et utilisation de votre site" },
  { id: "search-console", label: "Google Search Console", short: "Google Search Console", description: "Présence de votre site dans les résultats de recherche" },
  { id: "clarity", label: "Microsoft Clarity", short: "Microsoft Clarity", description: "Informations disponibles dans Microsoft Clarity" },
];

const formatNumber = (value: number) => new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 }).format(value);
const asObject = (value: unknown): RecordValue | null => value !== null && typeof value === "object" && !Array.isArray(value) ? value as RecordValue : null;
const asArray = (value: unknown): unknown[] => Array.isArray(value) ? value : [];
const numeric = (value: unknown): number | null => {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
};
const metricValue = (row: unknown, index: number): number | null => {
  const values = asArray(asObject(row)?.metricValues);
  return numeric(asObject(values[index])?.value);
};
const dayLabel = (value: unknown) => {
  const raw = String(value ?? "");
  if (/^\d{8}$/.test(raw)) return `${raw.slice(6, 8)}/${raw.slice(4, 6)}`;
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return `${raw.slice(8, 10)}/${raw.slice(5, 7)}`;
  return raw;
};
const clarityNames: Record<string, { title: string; detail: string }> = {
  DeadClickCount: { title: "Clics sans effet", detail: "Clics sans réaction apparente" },
  RageClickCount: { title: "Clics de frustration", detail: "Clics répétés rapidement" },
  ExcessiveScroll: { title: "Défilement excessif", detail: "Sessions avec défilement excessif" },
  QuickbackClick: { title: "Retours rapides", detail: "Retours rapides après navigation" },
  ScriptErrorCount: { title: "Erreurs JavaScript", detail: "Sessions avec erreurs de script" },
  ErrorClickCount: { title: "Clics sur erreur", detail: "Clics ayant entraîné une erreur" },
  ScrollDepth: { title: "Profondeur de défilement", detail: "Profondeur moyenne du défilement" },
  Traffic: { title: "Trafic", detail: "Sessions et utilisateurs mesurés" },
  EngagementTime: { title: "Temps d’engagement", detail: "Durées transmises par Clarity" },
  Browser: { title: "Navigateurs", detail: "Répartition par navigateur" },
  Device: { title: "Appareils", detail: "Répartition par appareil" },
  OS: { title: "Systèmes d’exploitation", detail: "Répartition par système" },
  Country: { title: "Pays", detail: "Répartition géographique" },
  PageTitle: { title: "Titres des pages", detail: "Pages consultées" },
  ReferrerUrl: { title: "Sources de trafic", detail: "Sites référents" },
  PopularPages: { title: "Pages populaires", detail: "Pages consultées fréquemment" },
};
const clarityFieldNames: Record<string, string> = {
  sessionsCount: "Sessions analysées",
  sessionsWithMetricPercentage: "Sessions concernées (%)",
  sessionsWithoutMetricPercentage: "Sessions non concernées (%)",
  pagesViews: "Pages vues",
  subTotal: "Total des événements",
  totalSessionCount: "Sessions humaines",
  totalBotSessionCount: "Sessions de robots",
  distinctUserCount: "Utilisateurs uniques",
  averageScrollDepth: "Profondeur moyenne de défilement",
  totalTime: "Temps total",
  activeTime: "Temps actif",
  name: "Nom",
  url: "URL",
  visitsCount: "Visites",
};
type ClarityField = { label: string; key: string; value: string; raw: unknown };
type ClaritySection = { key: string; metricName: string; title: string; detail: string; fields: ClarityField[] };

function clarityDisplay(section: ClaritySection): { primary: string; subtitle: string } {
  const field = (name: string) => section.fields.find(item => item.key.endsWith(`-${name}`));
  const value = (name: string) => field(name)?.value;
  const available = (name: string) => {
    const raw = field(name)?.raw;
    return raw !== null && raw !== undefined && raw !== "" && typeof raw !== "object";
  };
  const percentageMetrics = ["DeadClickCount", "ExcessiveScroll", "RageClickCount", "QuickbackClick", "ScriptErrorCount", "ErrorClickCount"];
  if (percentageMetrics.includes(section.metricName)) {
    return {
      primary: available("sessionsWithMetricPercentage") ? `${value("sessionsWithMetricPercentage")} %` : "—",
      subtitle: `Sessions concernées${available("sessionsCount") ? ` · ${value("sessionsCount")} session(s) analysée(s)` : ""}`,
    };
  }
  if (section.metricName === "Traffic") return {
    primary: available("totalSessionCount") ? value("totalSessionCount")! : "—",
    subtitle: `Sessions humaines${available("distinctUserCount") ? ` · ${value("distinctUserCount")} utilisateur(s) unique(s)` : ""}`,
  };
  if (section.metricName === "ScrollDepth") return {
    primary: available("averageScrollDepth") ? `${value("averageScrollDepth")} %` : "—",
    subtitle: "Profondeur moyenne de défilement",
  };
  if (section.metricName === "EngagementTime") return {
    primary: available("activeTime") ? value("activeTime")! : available("totalTime") ? value("totalTime")! : "—",
    subtitle: available("activeTime") ? "Temps actif (unité fournie par Clarity)" : "Temps total (unité fournie par Clarity)",
  };
  const breakdownMetrics = ["Browser", "Device", "OS", "Country", "PageTitle", "ReferrerUrl", "PopularPages"];
  if (breakdownMetrics.includes(section.metricName)) {
    const countKey = section.metricName === "PopularPages" ? "visitsCount" : "sessionsCount";
    const entries = section.fields.filter(item => item.key.endsWith(`-${countKey}`) && numeric(item.raw) !== null);
    const total = entries.reduce((sum, item) => sum + (numeric(item.raw) ?? 0), 0);
    const labelField = section.metricName === "PopularPages" ? "url" : "name";
    const first = section.fields.find(item => item.key === `0-${labelField}`);
    return {
      primary: entries.length ? formatNumber(total) : "—",
      subtitle: entries.length
        ? `${section.metricName === "PopularPages" ? "Visites" : "Sessions"} réparties · ${entries.length} catégorie(s)${first?.value && first.value !== "—" ? ` · ${first.value}` : ""}`
        : "Répartition indisponible",
    };
  }
  return { primary: "—", subtitle: "Données indisponibles" };
}
function claritySections(data: unknown): ClaritySection[] {
  const sections = Array.isArray(data) ? data : asArray(asObject(data)?.data);
  return sections.flatMap((section, index) => {
    const item = asObject(section);
    if (!item || typeof item.metricName !== "string") return [];
    const key = item.metricName;
    const known = clarityNames[key];
    const fields = asArray(item.information).flatMap((entry, entryIndex) => {
      const record = asObject(entry);
      if (!record) return [];
      return Object.entries(record).map(([field, value]) => ({
        key: `${entryIndex}-${field}`,
        label: clarityFieldNames[field] ?? field,
        value: value === null || value === undefined ? "—" : typeof value === "object" ? JSON.stringify(value) : String(value),
        raw: value,
      }));
    });
    return [{ key: `${index}-${key}`, metricName: key, title: known?.title ?? key, detail: known?.detail ?? "Indicateur Microsoft Clarity", fields }];
  });
}

function DailyTable({ rows, provider }: { rows: RecordValue[]; provider: "ga4" | "search-console" }) {
  if (rows.length === 0) return null;
  const isGa4 = provider === "ga4";
  const valueAt = (row: RecordValue, index: number): number | null =>
    isGa4 ? metricValue(row, index) : numeric(index === 0 ? row.clicks : row.impressions);
  const dateAt = (row: RecordValue): string => {
    const dimension = asObject(asArray(row.dimensionValues)[0]);
    return dayLabel(dimension?.value ?? asArray(row.keys)[0] ?? row.date ?? "—");
  };
  return <section className="sa-panel">
    <div className="sa-panel-head"><div><h3>Évolution quotidienne</h3><p>{isGa4 ? "Utilisateurs actifs et sessions par jour" : "Clics et impressions par jour"}</p></div></div>
    <div className="sa-table-wrap"><table className="sa-table"><thead><tr>
      <th>Date</th><th>{isGa4 ? "Utilisateurs" : "Clics"}</th><th>{isGa4 ? "Sessions" : "Impressions"}</th>
    </tr></thead><tbody>{rows.map((row, index) => <tr key={index}>
      <td>{dateAt(row)}</td><td>{valueAt(row, 0) === null ? "—" : formatNumber(valueAt(row, 0)!)}</td>
      <td>{valueAt(row, 1) === null ? "—" : formatNumber(valueAt(row, 1)!)}</td>
    </tr>)}</tbody></table></div>
  </section>;
}

function MetricCard({ label, value, description, suffix = "", accent = "blue" }: {
  label: string; value: number | null; description: string; suffix?: string; accent?: "blue" | "violet" | "teal" | "amber";
}) {
  return <div className="sa-metric">
    <div className={`sa-metric-mark sa-${accent}`} aria-hidden="true" />
    <div className="sa-metric-label">{label}</div>
    <div className="sa-metric-value">{value === null ? "—" : `${formatNumber(value)}${suffix}`}</div>
    <div className="sa-metric-description">{description}</div>
  </div>;
}

function EmptyState({ title, message }: { title: string; message: string }) {
  return <div className="sa-empty" role="status">
    <div className="sa-empty-icon" aria-hidden="true">i</div>
    <strong>{title}</strong>
    <p>{message}</p>
  </div>;
}

function DailyChart({ rows }: { rows: RecordValue[] }) {
  const points = rows.map((row) => ({
    label: dayLabel(asArray(row.keys)[0] ?? row.date ?? ""),
    clicks: numeric(row.clicks),
    impressions: numeric(row.impressions),
  })).filter((point) => point.impressions !== null);
  if (!points.length) return null;
  const max = Math.max(1, ...points.map((point) => point.impressions ?? 0));
  const visible = points.slice(-30);
  return <section className="sa-panel">
    <div className="sa-panel-head"><div><h3>Évolution de la visibilité</h3><p>Impressions quotidiennes dans les résultats Google</p></div><span className="sa-panel-tag">{visible.length} jours affichés</span></div>
    <div className="sa-chart" role="img" aria-label="Histogramme des impressions quotidiennes">
      {visible.map((point, index) => <div className="sa-chart-column" key={`${point.label}-${index}`} title={`${point.label} : ${formatNumber(point.impressions ?? 0)} impressions`}>
        <div className="sa-chart-bar" style={{ height: `${Math.max(3, ((point.impressions ?? 0) / max) * 100)}%` }} />
      </div>)}
    </div>
    <div className="sa-chart-axis"><span>{visible[0]?.label}</span><span>{visible[visible.length - 1]?.label}</span></div>
  </section>;
}

export default function IntegrationsDashboard() {
  const [sites, setSites] = useState<Site[]>([]);
  const [siteId, setSiteId] = useState("");
  const [provider, setProvider] = useState<Provider>("ga4");
  const [days, setDays] = useState(30);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState<unknown>(null);
  const [reload, setReload] = useState(0);
  const [siteError, setSiteError] = useState("");

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/admin/sites", { cache: "no-store", signal: controller.signal })
      .then(async r => { if (!r.ok) throw new Error("Chargement des sites impossible"); return r.json(); })
      .then(v => {
        const rows: Site[] = Array.isArray(v.sites) ? v.sites : [];
        setSites(rows);
        setSiteId(current => current || rows[0]?.id || "");
      })
      .catch(e => { if (e.name !== "AbortError") setSiteError("Impossible de charger les sites autorisés."); });
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!siteId) return;
    const controller = new AbortController();
    setLoading(true); setError(""); setResult(null);
    fetch(`/api/integrations?siteId=${encodeURIComponent(siteId)}&provider=${provider}&days=${days}`, { cache: "no-store", signal: controller.signal })
      .then(async r => { const v: ApiData = await r.json(); if (!r.ok) throw new Error(v.error || "Erreur de récupération"); return v; })
      .then(v => setResult(v.data ?? null))
      .catch(e => { if (e.name !== "AbortError") setError(e.message || "Données indisponibles"); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [siteId, provider, days, reload]);

  const data = asObject(result);
  const totals = asArray(data?.totals)[0];
  const daily = asArray(data?.daily).map(asObject).filter((v): v is RecordValue => v !== null);
  const queries = asArray(data?.queries).map(asObject).filter((v): v is RecordValue => v !== null);
  const clarityItems = useMemo(() => claritySections(result), [result]);
  const gaValues = [0, 1, 2, 3].map(i => metricValue(totals, i));
  const gaHasData = gaValues.some(v => v !== null);
  const gscClicks = daily.reduce((sum, r) => sum + (numeric(r.clicks) ?? 0), 0);
  const gscImpressions = daily.reduce((sum, r) => sum + (numeric(r.impressions) ?? 0), 0);
  const current = providers.find(p => p.id === provider)!;
  const selectedSite = sites.find(s => s.id === siteId);
  const hasRows = daily.length > 0;

  return <div className="sa-dashboard">
    <div className="sa-hero">
      <div className="sa-hero-copy"><span className="sa-eyebrow"><span className="sa-live-dot" /> ESPACE ANALYTIQUE</span><h2>Vue d’ensemble de vos performances</h2><p>Suivez les résultats de vos sites avec des indicateurs clairs, fiables et faciles à interpréter.</p></div>
      <div className="sa-hero-detail"><span>Site actuellement supervisé</span><strong>{selectedSite?.name || "Sélectionnez un site"}</strong><small>{selectedSite?.url || "Analyse des performances digitales"}</small></div>
    </div>

    <div className="sa-toolbar">
      <label className="sa-field"><span>Site supervisé</span><select value={siteId} onChange={e => setSiteId(e.target.value)} disabled={sites.length === 0}>{sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select></label>
       <label className="sa-field">
  <span>Période d’analyse</span>
  <select
    value={days}
    onChange={e => setDays(Number(e.target.value))}
    disabled={provider === "clarity"}
  >
    {provider === "clarity" ? (
      <option value={days}>
        3 derniers jours (API Clarity)
      </option>
    ) : (
      <>
        <option value={7}>7 derniers jours</option>
        <option value={30}>30 derniers jours</option>
        <option value={90}>90 derniers jours</option>
      </>
    )}
  </select>
</label>
      <button type="button" className="sa-refresh" onClick={() => setReload(v => v + 1)} disabled={loading || !siteId}><span aria-hidden="true">↻</span> {loading ? "Actualisation…" : "Actualiser les données"}</button>
    </div>

    <div className="sa-tabs" role="group" aria-label="Source des indicateurs">
      {providers.map(p => <button type="button" key={p.id} className={`sa-tab ${provider === p.id ? "sa-tab-active" : ""}`} onClick={() => setProvider(p.id)} aria-pressed={provider === p.id}>{p.short}</button>)}
    </div>

    <div className="sa-section-heading"><div><span className="sa-section-kicker">TABLEAU DE BORD</span><h2>{current.label}</h2><p>{current.description}</p></div></div>

    {siteError && <EmptyState title="Sites indisponibles" message={siteError} />}<span className="sa-period-badge">
  {provider === "clarity" ? "3 derniers jours" : `${days} jours`}
</span>
    {!siteError && sites.length === 0 && <EmptyState title="Aucun site accessible" message="Aucun site autorisé n’est disponible pour le moment." />}
    {loading && <div className="sa-loading" role="status"><span className="sa-spinner" /> Récupération des indicateurs en cours…</div>}
    {!loading && error && <EmptyState title="Données indisponibles" message={`${error} Aucun chiffre n’est affiché à la place de données non récupérées.`} />}

    {!loading && !error && result !== null && provider === "ga4" && <>
      {gaHasData ? <><div className="sa-metrics">
        <MetricCard label="Visiteurs actifs" value={gaValues[0]} description="Personnes actives mesurées" accent="blue" />
        <MetricCard label="Sessions" value={gaValues[1]} description="Visites enregistrées" accent="violet" />
        <MetricCard label="Pages consultées" value={gaValues[2]} description="Nombre de vues" accent="teal" />
        <MetricCard label="Conversions" value={gaValues[3]} description="Selon la configuration GA4" accent="amber" />
      </div>{daily.length > 0 && <DailyTable rows={daily} provider="ga4" />}<div className="sa-insight"><span className="sa-insight-icon" aria-hidden="true">✦</span><div><strong>À savoir</strong><p>Les données du jour peuvent être provisoires. Les conversions dépendent de la configuration de Google Analytics.</p></div></div></> : <EmptyState title="Aucun total disponible" message="Google Analytics n’a retourné aucun total pour cette période. Cela ne prouve pas qu’il n’y a eu aucun visiteur." />}
      {!gaHasData && daily.length > 0 && <DailyTable rows={daily} provider="ga4" />}
    </>}

    {!loading && !error && result !== null && provider === "search-console" && <>
      <div className="sa-metrics sa-metrics-three">
        <MetricCard label="Clics depuis Google" value={hasRows ? gscClicks : null} description="Clics issus des résultats de recherche" accent="blue" />
        <MetricCard label="Apparitions dans Google" value={hasRows ? gscImpressions : null} description="Impressions mesurées" accent="violet" />
        <MetricCard label="Taux de clic" value={hasRows && gscImpressions > 0 ? 100 * gscClicks / gscImpressions : null} suffix=" %" description="Part des impressions ayant généré un clic" accent="teal" />
      </div>
      {hasRows && <DailyChart rows={daily} />}
      {hasRows && <DailyTable rows={daily} provider="search-console" />}
      {queries.length > 0 && <section className="sa-panel"><div className="sa-panel-head"><div><h3>Recherches qui affichent votre site</h3><p>Termes de recherche transmis par Google Search Console</p></div></div><div className="sa-table-wrap"><table className="sa-table"><thead><tr><th>Recherche</th><th>Clics</th><th>Impressions</th><th>Taux de clic</th><th>Position moyenne</th></tr></thead><tbody>{queries.map((q, i) => <tr key={i}><td>{String(asArray(q.keys)[0] ?? "—")}</td><td>{formatNumber(numeric(q.clicks) ?? 0)}</td><td>{formatNumber(numeric(q.impressions) ?? 0)}</td><td>{numeric(q.ctr) === null ? "—" : `${formatNumber(Number(q.ctr) * 100)} %`}</td><td>{numeric(q.position) === null ? "—" : formatNumber(Number(q.position))}</td></tr>)}</tbody></table></div></section>}
      {!hasRows && <EmptyState title="Aucune donnée quotidienne" message="Search Console n’a transmis aucune donnée quotidienne pour la période sélectionnée." />}
      <div className="sa-insight"><span className="sa-insight-icon" aria-hidden="true">✦</span><div><strong>À savoir</strong><p>Search Console transmet généralement ses données avec plusieurs jours de décalage. Une période vide ne signifie pas nécessairement zéro visibilité.</p></div></div>
    </>}

    {!loading && !error && result !== null && provider === "clarity" && <>
      {clarityItems.length > 0 ? <>
        <div className="sa-clarity-grid">{clarityItems.map((item) => {
          const display = clarityDisplay(item);
          return <section className="sa-clarity-item" key={item.key}>
            <span className="sa-clarity-kicker">COMPORTEMENT UTILISATEUR</span>
            <h3>{item.title}</h3>
            <p className="sa-clarity-description">{item.detail}</p>
            <strong className="sa-clarity-primary">{display.primary}</strong>
            <span className="sa-clarity-subtitle">{display.subtitle}</span>
            <details className="sa-clarity-details"><summary>Voir les valeurs détaillées</summary>
              <dl>{item.fields.map(field => <div key={field.key}><dt>{field.label}</dt><dd>{field.value}</dd></div>)}</dl>
            </details>
          </section>;
        })}</div>
        <div className="sa-insight"><span className="sa-insight-icon" aria-hidden="true">✦</span><div><strong>À savoir</strong><p>Les pourcentages et les nombres de sessions affichés sont ceux fournis par Microsoft Clarity pour chaque indicateur. Ils ne représentent pas nécessairement le trafic total du site. La période de collecte Clarity peut différer de la période sélectionnée.</p></div></div>
      </> : <EmptyState title="Aucun indicateur reconnu" message="Clarity a répondu, mais aucun indicateur reconnu n’a pu être présenté. Aucune donnée n’a été inventée." />}
      <details className="sa-panel"><summary style={{cursor:"pointer",fontWeight:700}}>Réponse détaillée Microsoft Clarity</summary><pre style={{overflowX:"auto",whiteSpace:"pre-wrap",overflowWrap:"anywhere",fontSize:12,marginTop:16}}>{JSON.stringify(result, null, 2)}</pre></details>
    </>}

    {!loading && !error && result === null && !!siteId && <EmptyState title="Aucune réponse disponible" message="Aucune donnée n’a été reçue pour cette sélection." />}
    <p className="sa-footnote">Données issues des fournisseurs connectés · Les informations indisponibles ne sont jamais remplacées par des estimations · Ce tableau de bord ne constitue pas encore un rapport mensuel consolidé.</p>

    <style jsx global>{`
      .sa-dashboard{--sa-navy:#13294b;--sa-ink:#1a2d47;--sa-muted:#74839a;--sa-border:#e7ecf3;--sa-blue:#3267e9;display:grid;gap:24px;color:var(--sa-ink);font-family:inherit;min-width:0}
      .sa-hero{background:linear-gradient(115deg,#142b50 0%,#1e4177 62%,#2855a0 100%);color:#fff;border-radius:22px;padding:32px 34px;display:flex;align-items:center;justify-content:space-between;gap:26px;box-shadow:0 15px 35px rgba(22,51,96,.13);overflow:hidden}
      .sa-hero-copy{max-width:610px}.sa-eyebrow{font-size:10px;letter-spacing:2px;font-weight:800;color:#bdd3ff;display:flex;align-items:center;gap:9px}.sa-live-dot{width:8px;height:8px;border-radius:50%;background:#62e5c4;display:inline-block}.sa-hero h2{color:#fff;font-size:clamp(22px,3vw,32px);line-height:1.2;letter-spacing:-.8px;margin:16px 0 10px;font-weight:750}.sa-hero p{color:#d6e4fa;line-height:1.65;font-size:14px;margin:0}.sa-hero-detail{border:1px solid rgba(255,255,255,.2);background:rgba(255,255,255,.08);border-radius:16px;padding:18px 22px;min-width:210px;max-width:270px;display:grid;gap:8px}.sa-hero-detail span{font-size:11px;color:#bfd1ed}.sa-hero-detail strong{font-size:19px;color:#fff;overflow-wrap:anywhere}.sa-hero-detail small{font-size:11px;color:#d5e2f4;overflow-wrap:anywhere}
      .sa-toolbar{display:flex;flex-wrap:wrap;gap:14px;align-items:end;padding:19px 21px;border:1px solid var(--sa-border);border-radius:17px;background:#fff;box-shadow:0 5px 20px rgba(27,54,89,.035)}.sa-field{display:grid;gap:8px;min-width:190px;flex:1}.sa-field span{font-size:11px;font-weight:750;color:#53647c}.sa-field select{width:100%;max-width:100%;min-height:42px;background:#f8faff;color:var(--sa-ink);border:1px solid #dfe7f1;border-radius:10px;padding:9px 12px;font:inherit;font-size:13px}.sa-field select:focus-visible,.sa-refresh:focus-visible,.sa-tab:focus-visible{outline:3px solid #9ab7ff;outline-offset:2px}.sa-refresh{border:0;background:var(--sa-blue);color:#fff;border-radius:10px;min-height:42px;padding:10px 17px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.sa-refresh span{font-size:18px;vertical-align:-1px;margin-right:4px}.sa-refresh:disabled{opacity:.6;cursor:wait}
      .sa-tabs{display:flex;flex-wrap:wrap;gap:7px;padding:6px;border-radius:13px;background:#edf2f9;width:fit-content;max-width:100%}.sa-tab{border:0;background:transparent;color:#65758d;border-radius:9px;padding:11px 17px;font:inherit;font-size:12px;font-weight:750;cursor:pointer}.sa-tab-active{background:#fff;color:#214d9b;box-shadow:0 2px 9px rgba(21,48,84,.09)}.sa-section-heading{display:flex;justify-content:space-between;align-items:center;gap:15px}.sa-section-kicker{font-size:10px;letter-spacing:1.7px;color:#6384b5;font-weight:800}.sa-section-heading h2{margin:7px 0 5px;font-size:23px;letter-spacing:-.5px;color:var(--sa-navy)}.sa-section-heading p{margin:0;color:var(--sa-muted);font-size:13px}.sa-period-badge{background:#edf4ff;color:#3566ae;border-radius:100px;padding:9px 13px;font-size:11px;font-weight:750;white-space:nowrap}
      .sa-metrics{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:15px}.sa-metrics-three{grid-template-columns:repeat(3,minmax(0,1fr))}.sa-metric{background:#fff;border:1px solid var(--sa-border);border-radius:17px;padding:23px 21px;box-shadow:0 7px 22px rgba(29,56,92,.045);min-width:0}.sa-metric-mark{width:31px;height:5px;border-radius:10px;margin-bottom:22px}.sa-blue{background:#477bf0}.sa-violet{background:#9473ed}.sa-teal{background:#2dbda7}.sa-amber{background:#f1b45c}.sa-metric-label{font-size:12px;color:#687b95;font-weight:700}.sa-metric-value{font-size:clamp(25px,3vw,36px);font-weight:800;letter-spacing:-1px;color:#172e50;margin:12px 0 8px;overflow-wrap:anywhere}.sa-metric-description{font-size:11px;color:#8a98aa;line-height:1.5}
      .sa-insight{display:flex;align-items:flex-start;gap:14px;padding:19px 21px;border:1px solid #dce9fb;background:#f5f9ff;border-radius:14px}.sa-insight-icon{display:grid;place-items:center;flex-shrink:0;width:32px;height:32px;border-radius:10px;background:#e4edff;color:#3c6dcc;font-size:19px}.sa-insight strong{font-size:12px;color:#254c83}.sa-insight p{font-size:12px;line-height:1.7;color:#617b9b;margin:5px 0 0}
      .sa-panel{background:#fff;border:1px solid var(--sa-border);border-radius:17px;padding:23px;box-shadow:0 7px 22px rgba(29,56,92,.04);min-width:0}.sa-panel-head{display:flex;justify-content:space-between;gap:15px;align-items:start;margin-bottom:24px}.sa-panel-head h3{margin:0 0 7px;color:#1a3154;font-size:16px}.sa-panel-head p{margin:0;color:var(--sa-muted);font-size:12px}.sa-panel-tag{font-size:11px;color:#6c85a9;background:#f1f5fb;padding:7px 10px;border-radius:8px;white-space:nowrap}.sa-chart{height:190px;display:flex;align-items:end;gap:4px;border-bottom:1px solid #dfe7f1;padding:0 2px}.sa-chart-column{flex:1;height:100%;min-width:0;display:flex;align-items:end}.sa-chart-bar{background:linear-gradient(180deg,#497ef0,#9cbcff);border-radius:5px 5px 0 0;width:100%;min-height:3px}.sa-chart-axis{display:flex;justify-content:space-between;font-size:11px;color:#8290a3;margin-top:11px}.sa-table-wrap{overflow-x:auto}.sa-table{border-collapse:collapse;width:100%;min-width:570px;font-size:12px;text-align:left}.sa-table th{color:#7a8ca5;background:#f6f8fc;font-weight:750}.sa-table th,.sa-table td{padding:13px 12px;border-bottom:1px solid #edf1f6}.sa-table td{color:#354b68;overflow-wrap:anywhere}.sa-table tr:last-child td{border-bottom:0}
      .sa-clarity-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:14px}.sa-clarity-item{background:#fff;border:1px solid var(--sa-border);border-radius:14px;padding:20px;display:grid;gap:13px;min-width:0}.sa-clarity-item span{font-size:12px;color:#72849d;overflow-wrap:anywhere}.sa-clarity-item strong{font-size:19px;color:#193454;overflow-wrap:anywhere}.sa-clarity-item h3{font-size:16px;line-height:1.35;margin:0;color:#193454}.sa-clarity-kicker{font-size:9px!important;font-weight:800;letter-spacing:1.2px;color:#5176b5!important}.sa-clarity-description{font-size:12px;color:#73849b;margin:0;line-height:1.5}.sa-clarity-primary{font-size:32px!important;letter-spacing:-1px;color:#3267e9!important}.sa-clarity-subtitle{font-size:11px!important}.sa-clarity-details{border-top:1px solid #e7ecf3;padding-top:12px}.sa-clarity-details summary{font-size:12px;font-weight:700;color:#3267e9;cursor:pointer}.sa-clarity-details dl{margin:12px 0 0;display:grid;gap:10px}.sa-clarity-details dl div{display:flex;justify-content:space-between;gap:10px}.sa-clarity-details dt,.sa-clarity-details dd{font-size:11px;margin:0;color:#60738d}.sa-clarity-details dd{font-weight:750;color:#1b3559;text-align:right}.sa-empty{background:#fff;border:1px dashed #cfdbeb;border-radius:17px;text-align:center;padding:46px 22px;display:grid;justify-items:center;gap:10px}.sa-empty-icon{display:grid;place-items:center;width:40px;height:40px;border-radius:50%;background:#edf4ff;color:#3d6bb5;font-size:21px;font-family:serif;font-weight:bold}.sa-empty strong{font-size:16px;color:#253e60}.sa-empty p{margin:0;max-width:540px;color:#7a8ba2;line-height:1.7;font-size:13px}.sa-loading{padding:32px;text-align:center;color:#6a7e99;font-size:13px}.sa-spinner{display:inline-block;width:15px;height:15px;border:2px solid #dce6f7;border-top-color:#3d70df;border-radius:50%;vertical-align:-3px;margin-right:8px;animation:sa-spin .8s linear infinite}@keyframes sa-spin{to{transform:rotate(360deg)}}.sa-footnote{font-size:11px;color:#8996a7;line-height:1.7;margin:0;padding-bottom:5px}
      @media(max-width:900px){.sa-metrics{grid-template-columns:repeat(2,minmax(0,1fr))}.sa-clarity-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.sa-hero{padding:26px}.sa-hero-detail{min-width:170px}}
      @media(max-width:600px){.sa-dashboard{gap:19px}.sa-hero{flex-direction:column;align-items:stretch;padding:24px 20px;border-radius:16px}.sa-hero-detail{max-width:none}.sa-toolbar{padding:15px}.sa-field{flex-basis:100%}.sa-refresh{width:100%}.sa-tabs{width:100%}.sa-tab{flex:1 1 100%;padding:10px 8px;font-size:11px}.sa-section-heading h2{font-size:20px}.sa-metrics,.sa-metrics-three,.sa-clarity-grid{grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}.sa-metric{padding:17px 14px}.sa-metric-value{font-size:26px}.sa-panel{padding:16px}.sa-panel-tag{display:none}}
      @media(max-width:380px){.sa-metrics,.sa-metrics-three,.sa-clarity-grid{grid-template-columns:1fr}}
    `}</style>
  </div>;
}
