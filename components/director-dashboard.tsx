import Link from "next/link";
import Logout from "@/components/logout";
import { Activity, ArrowUpRight, FolderKanban, Gauge, Monitor, Smartphone, TriangleAlert } from "lucide-react";

type Site = { id: string; name: string; url: string; active: boolean };
type Report = { site_id: string; report_date: string; generated_at: string; content: unknown };
type Strategy = "mobile" | "desktop";

function score(report: Report | undefined, strategy: Strategy): number | null {
  if (!report || !report.content || typeof report.content !== "object") return null;
  const content = report.content as { audit?: { latest?: Record<string, { scores?: { performance?: unknown } } | null> } };
  const value = content.audit?.latest?.[strategy]?.scores?.performance;
  return typeof value === "number" && Number.isFinite(value) && value >= 0 && value <= 100 ? Math.round(value) : null;
}
function format(value: number | null) { return value === null ? "N/D" : `${value}/100`; }
function average(values: (number | null)[]): number | null {
  const valid = values.filter((v): v is number => v !== null);
  return valid.length ? Math.round(valid.reduce((a, b) => a + b, 0) / valid.length) : null;
}
function Trend({ reports, sites }: { reports: Report[]; sites: Site[] }) {
  const dates = [...new Set(reports.map(r => r.report_date))].sort();
  const series = (["mobile", "desktop"] as const).map(strategy => ({
    strategy,
    points: dates.map((date, index) => {
      const values = sites.map(site => score(reports.find(r => r.site_id === site.id && r.report_date === date), strategy));
      return { index, value: average(values) };
    }),
  }));
  const w = 760, h = 240, left = 42, right = 18, top = 18, bottom = 32;
  const x = (i: number) => left + (dates.length <= 1 ? (w - left - right) / 2 : i * (w - left - right) / (dates.length - 1));
  const y = (v: number) => top + (100 - v) * (h - top - bottom) / 100;
  const segments = (points: {index:number;value:number|null}[]) => {
    const chunks: string[] = []; let current: string[] = [];
    for (const p of points) {
      if (p.value === null) { if (current.length) chunks.push(current.join(" ")); current = []; }
      else current.push(`${x(p.index)},${y(p.value)}`);
    }
    if (current.length) chunks.push(current.join(" "));
    return chunks;
  };
  const hasData = series.some(s => s.points.some(p => p.value !== null));
  return <section className="panel director-chart"><div className="director-section-heading"><div><h2>Évolution des performances</h2><p className="muted">Moyenne des projets actifs · 30 derniers jours</p></div><div className="director-legend"><span><i className="director-dot director-mobile"/>Mobile</span><span><i className="director-dot director-desktop"/>Desktop</span></div></div>
    {hasData ? <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Graphique des scores Lighthouse moyens Mobile et Desktop" className="director-svg">
      {[0,25,50,75,100].map(v => <g key={v}><line x1={left} y1={y(v)} x2={w-right} y2={y(v)} stroke="var(--line)"/><text x={left-10} y={y(v)+4} fill="var(--muted)" fontSize="12" textAnchor="end">{v}</text></g>)}
      {series.map(s => <g key={s.strategy} stroke={s.strategy === "mobile" ? "#426cf2" : "#18a68d"} fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">{segments(s.points).map((segment,i) => <polyline key={i} points={segment}/>)}{s.points.filter(p=>p.value!==null).map(p=><circle key={p.index} cx={x(p.index)} cy={y(p.value!)} r="3.5" fill="var(--card)"/>)}</g>)}
      {dates.length > 0 && <><text x={left} y={h-7} fill="var(--muted)" fontSize="12">{dates[0]}</text><text x={w-right} y={h-7} fill="var(--muted)" fontSize="12" textAnchor="end">{dates[dates.length-1]}</text></>}
    </svg> : <p className="muted director-empty">Aucune mesure disponible sur les 30 derniers jours.</p>}
  </section>;
}
export default function DirectorDashboard({email,sites,reports}:{email:string;sites:Site[];reports:Report[]}) {
  const active = sites.filter(s => s.active);
  const latest = new Map<string, Report>();
  for (const report of [...reports].sort((a,b) => b.report_date.localeCompare(a.report_date) || b.generated_at.localeCompare(a.generated_at))) {
    if (!latest.has(report.site_id)) latest.set(report.site_id, report);
  }
  const rows = active.map(site => ({site, report:latest.get(site.id), mobile:score(latest.get(site.id),"mobile"),desktop:score(latest.get(site.id),"desktop")}));
  const mobile = average(rows.map(r=>r.mobile));
  const desktop = average(rows.map(r=>r.desktop));
  const attention = rows.filter(r => (r.mobile !== null && r.mobile < 50) || (r.desktop !== null && r.desktop < 50)).length;
  return <main className="wrap section director-dashboard">
    <header className="admin-head"><div><p className="admin-eyebrow">Espace sécurisé · Syncore Analytics</p><h1>Espace Direction</h1><p className="muted">Bienvenue {email}. Vue stratégique des projets supervisés.</p></div><span className="chip">Directeur · Lecture seule</span></header>
    <section className="director-kpis" aria-label="Indicateurs clés">
      {[{label:"Projets actifs",value:String(active.length),icon:FolderKanban},{label:"Performance Mobile",value:format(mobile),icon:Smartphone},{label:"Performance Desktop",value:format(desktop),icon:Monitor},{label:"Projets à surveiller",value:String(attention),icon:TriangleAlert}].map(({label,value,icon:Icon})=><article className="panel director-kpi" key={label}><div className="director-kpi-top"><span>{label}</span><Icon size={20} aria-hidden="true"/></div><strong>{value}</strong></article>)}
    </section>
    <Trend reports={reports} sites={active}/>
    <section className="panel director-projects"><div className="director-section-heading"><div><h2>Performance par projet</h2><p className="muted">Dernier rapport disponible par site sur les 30 derniers jours</p></div><Gauge size={21} aria-hidden="true"/></div><div className="director-table-scroll"><table><thead><tr><th>Projet</th><th>Mobile</th><th>Desktop</th><th>Rapport</th></tr></thead><tbody>{rows.map(({site,report,mobile,desktop})=><tr key={site.id}><td><strong>{site.name}</strong><small>{site.url}</small></td><td>{format(mobile)}</td><td>{format(desktop)}</td><td>{report?.report_date ?? "Non disponible"}</td></tr>)}</tbody></table></div>{rows.length===0 && <p className="muted">Aucun projet actif.</p>}</section>
    <section className="admin-cards" aria-label="Accès aux modules"><article className="admin-card"><span className="admin-card-icon"><FolderKanban size={22}/></span><h2>Sites supervisés</h2><p>Consulter les projets et leur configuration.</p><Link className="btn" href="/admin/sites">Consulter les sites <ArrowUpRight size={16}/></Link></article><article className="admin-card"><span className="admin-card-icon"><Activity size={22}/></span><h2>Analyses et intégrations</h2><p>Consulter Google Analytics 4, Search Console et Microsoft Clarity.</p><Link className="btn" href="/admin/integrations">Voir les analyses <ArrowUpRight size={16}/></Link></article></section>
    <div className="admin-signout"><Logout/></div>
  </main>;
}
