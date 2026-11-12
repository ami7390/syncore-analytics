"use client";
import { useCallback, useEffect, useState } from "react";

type Site = { id: string; name: string; url: string };
type Status = "todo" | "in_progress" | "done" | "blocked";
type Entry = { id: string; site_id: string; title: string; details: string; status: Status; category: string; created_at: string; completed_at: string | null };
const statusLabels: Record<Status, string> = { todo: "À faire", in_progress: "En cours", done: "Réalisé", blocked: "Bloqué" };
const categories = [{ value: "fix", label: "Correction" }, { value: "improvement", label: "Amélioration" }, { value: "deployment", label: "Déploiement" }, { value: "maintenance", label: "Maintenance" }, { value: "other", label: "Autre" }];
export default function ProjectJournal() {
  const [sites, setSites] = useState<Site[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [siteId, setSiteId] = useState("");
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [status, setStatus] = useState<Status>("todo");
  const [category, setCategory] = useState("improvement");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const load = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/journal", { cache: "no-store" });
      const json = await response.json();
      if (!response.ok) throw new Error(json.error || "Lecture impossible");
      setSites(json.sites); setEntries(json.entries);
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur de chargement"); }
  }, []);
  useEffect(() => { void load(); }, [load]);
  async function save(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/journal", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId, title, details, status, category }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Enregistrement impossible");
      setTitle(""); setDetails(""); setMessage("Travail enregistré."); await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur"); }
    finally { setBusy(false); }
  }
  async function update(id: string, nextStatus: Status) {
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/journal", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id, status: nextStatus }) });
      const json = await response.json(); if (!response.ok) throw new Error(json.error || "Modification impossible");
      await load();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Erreur"); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 24 }}>
    <form onSubmit={save} style={{ display: "grid", gap: 12, padding: 20, border: "1px solid var(--line)", borderRadius: 14 }}>
      <h2 style={{ margin: 0, fontSize: 18 }}>Enregistrer une intervention</h2>
      <label>Projet<select className="input" required value={siteId} onChange={event => setSiteId(event.target.value)}><option value="">Choisir un projet</option>{sites.map(site => <option key={site.id} value={site.id}>{site.name}</option>)}</select></label>
      <label>Travail ou amélioration<input className="input" required minLength={3} maxLength={160} value={title} onChange={event => setTitle(event.target.value)} placeholder="Ex. Corriger la navigation mobile" /></label>
      <label>Description<textarea className="input" rows={3} maxLength={5000} value={details} onChange={event => setDetails(event.target.value)} placeholder="Travaux effectués, constat et vérification..." /></label>
      <label>Catégorie<select className="input" value={category} onChange={event => setCategory(event.target.value)}>{categories.map(item => <option key={item.value} value={item.value}>{item.label}</option>)}</select></label>
      <label>État<select className="input" value={status} onChange={event => setStatus(event.target.value as Status)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <button className="btn" type="submit" disabled={busy || !sites.length}>Enregistrer dans le journal</button>
    </form>
    <section style={{ display: "grid", gap: 12 }}><h2 style={{ margin: 0, fontSize: 18 }}>Historique des travaux</h2>
      {message && <p role="status" className="muted">{message}</p>}
      {!entries.length && <p className="muted">Aucun travail enregistré pour le moment.</p>}
      {entries.map(entry => <article key={entry.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 16, display: "grid", gap: 8 }}>
        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8 }}><strong>{entry.title}</strong><span className="chip">{sites.find(site => site.id === entry.site_id)?.name ?? "Projet"}</span></div>
        {entry.details && <p className="muted" style={{ margin: 0, whiteSpace: "pre-wrap" }}>{entry.details}</p>}
        <small className="muted">Créé le {new Date(entry.created_at).toLocaleString("fr-FR")}{entry.completed_at ? ` · Réalisé le ${new Date(entry.completed_at).toLocaleString("fr-FR")}` : ""}</small>
        <label>État <select className="input" disabled={busy} value={entry.status} onChange={event => void update(entry.id, event.target.value as Status)}>{Object.entries(statusLabels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      </article>)}
    </section>
  </div>;
}
