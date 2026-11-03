"use client";
import { useCallback, useEffect, useState } from "react";
type Role = "owner" | "admin" | "director";
type Site = { id: string; name: string; url: string; description: string; active: boolean; assigned_user_ids: string[] };
type Administrator = { id: string; email: string };
export default function SiteManager({ role }: { role: Role }) {
 const [sites, setSites] = useState<Site[]>([]);
 const [admins, setAdmins] = useState<Administrator[]>([]);
 const [name, setName] = useState(""); const [url, setUrl] = useState(""); const [description, setDescription] = useState("");
 const [loading, setLoading] = useState(true); const [busy, setBusy] = useState(false); const [message, setMessage] = useState("");
 const load = useCallback(async () => {
  try { const res = await fetch("/api/admin/sites", { cache: "no-store" }); const data = await res.json(); if (!res.ok) throw new Error(data.error ?? "Chargement impossible"); setSites(data.sites); setAdmins(data.administrators); }
  catch (e) { setMessage(e instanceof Error ? e.message : "Erreur de chargement"); }
  finally { setLoading(false); }
 }, []);
 useEffect(() => { void load(); }, [load]);
 async function create(e: React.FormEvent<HTMLFormElement>) {
  e.preventDefault(); setBusy(true); setMessage("");
  try { const res = await fetch("/api/admin/sites", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name, url, description }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setName(""); setUrl(""); setDescription(""); setMessage("Site ajouté."); await load(); }
  catch (e) { setMessage(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
 }
 async function update(site: Site, changes: object) {
  setBusy(true); setMessage("");
  try { const res = await fetch("/api/admin/sites", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: site.id, ...changes }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setMessage("Site mis à jour."); await load(); }
  catch (e) { setMessage(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
 }
 async function assign(site: Site, userIds: string[]) {
  setBusy(true); setMessage("");
  try { const res = await fetch("/api/admin/sites/assignments", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ siteId: site.id, userIds }) }); const data = await res.json(); if (!res.ok) throw new Error(data.error); setMessage("Attributions enregistrées."); await load(); }
  catch (e) { setMessage(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
 }
 return <div style={{ display: "grid", gap: 22 }}>
  {role === "owner" && <form onSubmit={create} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 20, display: "grid", gap: 12 }}>
   <h2 style={{ margin: 0, fontSize: 19 }}>Ajouter un site</h2>
   <input className="field" required minLength={2} maxLength={120} placeholder="Nom du site" value={name} onChange={e => setName(e.target.value)} />
   <input className="field" type="url" required placeholder="https://exemple.com" value={url} onChange={e => setUrl(e.target.value)} />
   <textarea className="field" maxLength={1000} placeholder="Description (facultative)" value={description} onChange={e => setDescription(e.target.value)} />
   <button className="btn" disabled={busy}>Ajouter le site</button>
  </form>}
  {message && <p role="status" className="notice" style={{ margin: 0 }}>{message}</p>}
  <section><h2 style={{ fontSize: 19 }}>Sites supervisés ({sites.length})</h2>
   {loading ? <p className="muted">Chargement…</p> : sites.length === 0 ? <p className="muted">Aucun site disponible pour votre compte.</p> : <div style={{ display: "grid", gap: 14 }}>
    {sites.map(site => <article key={site.id} style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 18, display: "grid", gap: 12 }}>
     <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}><div><h3 style={{ margin: "0 0 6px" }}>{site.name}</h3><a href={site.url} target="_blank" rel="noopener noreferrer" style={{ color: "var(--green)", overflowWrap: "anywhere" }}>{site.url}</a></div><span className="chip" style={{ margin: 0 }}>{site.active ? "Actif" : "Inactif"}</span></div>
     {site.description && <p className="muted" style={{ margin: 0 }}>{site.description}</p>}
     {role === "owner" && <div style={{ display: "grid", gap: 8 }}><strong style={{ fontSize: 14 }}>Administrateurs attribués</strong>{admins.length === 0 ? <p className="muted" style={{ margin: 0 }}>Créez d'abord un compte administrateur.</p> : admins.map(a => <label key={a.id} style={{ display: "flex", gap: 9, alignItems: "center", fontSize: 14 }}><input type="checkbox" disabled={busy} checked={site.assigned_user_ids.includes(a.id)} onChange={e => { const next = e.target.checked ? [...site.assigned_user_ids, a.id] : site.assigned_user_ids.filter(x => x !== a.id); void assign(site, next); }} />{a.email}</label>)}</div>}
     {role !== "director" && <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}><button type="button" className="btn secondary" disabled={busy} onClick={() => { const value = window.prompt("Nom du site", site.name); if (value !== null && value.trim() !== site.name) void update(site, { name: value.trim() }); }}>Renommer</button><button type="button" className="btn secondary" disabled={busy} onClick={() => { const value = window.prompt("Description", site.description); if (value !== null) void update(site, { description: value }); }}>Description</button>{role === "owner" && <><button type="button" className="btn secondary" disabled={busy} onClick={() => { const value = window.prompt("URL HTTPS", site.url); if (value !== null) void update(site, { url: value }); }}>Modifier l'URL</button><button type="button" className="btn secondary" disabled={busy} onClick={() => void update(site, { active: !site.active })}>{site.active ? "Désactiver" : "Réactiver"}</button></>}</div>}
    </article>)}
   </div>}
  </section>
 </div>;
}
