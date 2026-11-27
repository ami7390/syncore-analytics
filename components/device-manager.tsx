"use client";
import { useEffect, useState } from "react";
type Device = { id: string; user_id: string; status: string; created_at: string };
export default function DeviceManager() {
 const [rows,setRows] = useState<Device[]>([]); const [error,setError] = useState(""); const [busy,setBusy] = useState(false);
 async function load() { try { const r = await fetch("/api/admin/devices", { cache: "no-store" }); const d = await r.json(); if (!r.ok) throw new Error(d.error); setRows(d.devices); } catch(e) { setError(e instanceof Error ? e.message : "Erreur"); } }
 useEffect(() => { void load(); }, []);
 async function decide(id: string,status: string) { if (!window.confirm(`Confirmer : ${status} ? Verifiez l'identifiant de la demande.`)) return; setBusy(true); setError(""); try { const r = await fetch("/api/admin/devices", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id,status }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error); await load(); } catch(e) { setError(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); } }
 return <><button className="btn" onClick={load}>Actualiser</button><p>{error}</p>{rows.map(d => <article className="panel" key={d.id}><p>Demande : {d.id}</p><p>Utilisateur : {d.user_id}</p><p>{d.status} · {new Date(d.created_at).toLocaleString()}</p>{d.status === "pending" && <><button className="btn" disabled={busy} onClick={() => decide(d.id,"approved")}>Approuver</button> <button className="btn" disabled={busy} onClick={() => decide(d.id,"denied")}>Refuser</button></>}{d.status === "approved" && <button className="btn" disabled={busy} onClick={() => decide(d.id,"revoked")}>Revoquer</button>}</article>)}</>;
}
