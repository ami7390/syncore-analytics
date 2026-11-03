"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
type Role = "owner" | "admin" | "director";
type Member = { user_id: string; role: Role; active: boolean; created_at?: string; email?: string };
export default function UserManager({ initialUsers }: { initialUsers: Member[] }) {
  const router = useRouter();
  const [users, setUsers] = useState(initialUsers);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "director">("admin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  async function create(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/users", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, role }) });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Création impossible");
      setUsers(prev => [json.user, ...prev]); setEmail(""); setPassword(""); setMessage("Compte créé avec succès."); router.refresh();
    } catch (e) { setMessage(e instanceof Error ? e.message : "Erreur inattendue"); }
    finally { setBusy(false); }
  }
  async function update(user: Member, change: Partial<Member>) {
    setBusy(true); setMessage("");
    try {
      const res = await fetch("/api/admin/users", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: user.user_id, role: change.role ?? user.role, active: change.active ?? user.active }) });
      const json = await res.json(); if (!res.ok) throw new Error(json.error || "Modification impossible");
      setUsers(prev => prev.map(u => u.user_id === user.user_id ? { ...u, ...change } : u)); setMessage("Accès mis à jour.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Erreur inattendue"); }
    finally { setBusy(false); }
  }
  return <div style={{ display: "grid", gap: 24 }}>
    <form onSubmit={create} style={{ display: "grid", gap: 12, maxWidth: 540 }}>
      <h2 className="sectiontitle">Créer un compte</h2>
      <label>Email<input className="field" style={{ width: "100%" }} type="email" autoComplete="off" required value={email} onChange={e => setEmail(e.target.value)}/></label>
      <label>Mot de passe initial (12 caractères minimum)<input className="field" style={{ width: "100%" }} type="password" autoComplete="new-password" minLength={12} required value={password} onChange={e => setPassword(e.target.value)}/></label>
      <label>Rôle<select className="field" style={{ width: "100%" }} value={role} onChange={e => setRole(e.target.value as "admin" | "director")}><option value="admin">Administrateur</option><option value="director">Directeur</option></select></label>
      <button className="btn" disabled={busy}>Créer le compte</button>
    </form>
    {message && <p role="status" className="notice">{message}</p>}
    <h2 className="sectiontitle">Comptes autorisés</h2>
    <div style={{ display: "grid", gap: 12 }}>
      {users.map(user => <div className="panel" key={user.user_id} style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12, justifyContent: "space-between" }}>
        <div><strong>{user.email ?? `Compte ${user.user_id.slice(0, 8)}…`}</strong><div className="muted" style={{ fontSize: 12 }}>{user.user_id}</div></div>
        {user.role === "owner" ? <span className="chip">Admin principal</span> : <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <select className="field" aria-label="Rôle" disabled={busy} value={user.role} onChange={e => update(user, { role: e.target.value as "admin" | "director" })}><option value="admin">Administrateur</option><option value="director">Directeur</option></select>
          <button className="btn secondary" disabled={busy} onClick={() => update(user, { active: !user.active })}>{user.active ? "Désactiver" : "Réactiver"}</button>
        </div>}
      </div>)}
    </div>
  </div>;
}
