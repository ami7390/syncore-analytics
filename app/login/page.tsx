"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        cache: "no-store",
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        setError("Identifiants invalides ou compte non autorisé.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch {
      setError("Connexion impossible. Réessayez.");
    } finally {
      setLoading(false);
    }
  }
  return <main className="wrap"><div className="panel login"><h1>Administration</h1><p className="muted">Connexion réservée aux administrateurs autorisés.</p><form onSubmit={submit}><label>Email<input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} required/></label><label>Mot de passe<input className="field" type="password" value={password} onChange={e => setPassword(e.target.value)} required/></label><button className="btn" disabled={loading}>{loading ? "Connexion…" : "Se connecter"}</button>{error && <p className="error">{error}</p>}</form></div></main>;
}
