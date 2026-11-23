"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function MfaPage() {
  const router = useRouter();
  const [role, setRole] = useState("admin");
  const [factorId, setFactorId] = useState("");
  const [qr, setQr] = useState("");
  const [secret, setSecret] = useState("");
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    fetch("/api/auth/mfa", { cache: "no-store" }).then(async r => {
      if (!r.ok) { router.replace("/login"); return; }
      const data = await r.json();
      setRole(data.role);
      if (data.currentLevel === "aal2") { router.replace(data.role === "director" ? "/directeur" : "/admin"); return; }
      if (data.factors?.length) setFactorId(data.factors[0].id);
      setReady(true);
    }).catch(() => setError("Impossible de charger la verification."));
  }, [router]);
  async function enroll() {
    setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "enroll" }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setFactorId(data.factorId); setQr(data.qrCode); setSecret(data.secret);
    } catch (e) { setError(e instanceof Error ? e.message : "Erreur"); }
    finally { setBusy(false); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError("");
    try {
      const res = await fetch("/api/auth/mfa", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "verify", factorId, code }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      router.replace(role === "director" ? "/directeur" : "/admin"); router.refresh();
    } catch (e) { setError(e instanceof Error ? e.message : "Code invalide"); }
    finally { setBusy(false); }
  }
  return <main className="wrap"><section className="panel login"><h1>Verification de securite</h1><p className="muted">Code temporaire de votre application d’authentification.</p>
    {ready && !factorId && <button className="btn" disabled={busy} onClick={enroll}>Configurer mon authentificateur</button>}
    {qr && <div><p>Scannez ce QR code dans votre application TOTP.</p><img src={qr} alt="QR code de configuration MFA" style={{ maxWidth: 180 }} /><p>Cle de secours de configuration (a conserver en lieu sur) : <code>{secret}</code></p></div>}
    {ready && factorId && <form onSubmit={verify}><label>Code a 6 chiffres<input className="field" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]{6}" value={code} onChange={e => setCode(e.target.value)} required /></label><button className="btn" disabled={busy}>{busy ? "Verification…" : "Verifier et acceder"}</button></form>}
    {error && <p className="error">{error}</p>}
  </section></main>;
}
