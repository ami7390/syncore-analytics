"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Logout from "@/components/logout";
export default function DevicePage() {
 const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const router = useRouter();
 async function check() {
  setBusy(true);
  try {
   const r = await fetch("/api/auth/device", { method: "POST", cache: "no-store" }); const d = await r.json();
   if (!r.ok) throw new Error(d.error);
   if (!d.required || d.device?.status === "approved") { router.replace(d.role === "director" ? "/directeur" : "/admin"); router.refresh(); return; }
   setMessage(`Demande ${d.device?.id ?? ""} : ${d.device?.status === "pending" ? "en attente" : "refusee ou revoquee"}.`);
  } catch(e) { setMessage(e instanceof Error ? e.message : "Erreur"); } finally { setBusy(false); }
 }
 return <main className="wrap"><section className="panel login"><h1>Autorisation du navigateur</h1><p>Votre navigateur doit etre approuve par le proprietaire.</p><button className="btn" disabled={busy} onClick={check}>Demander ou verifier mon autorisation</button><p>{message}</p><Logout /></section></main>;
}
