import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import type { Strategy } from "@/lib/pagespeed";

export const runtime = "nodejs";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante");
  return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: NextRequest) {
  try {
    // Mode test prive : aucun domaine arbitraire n'est accepte.
    const body: unknown = await req.json();
    if (!body || typeof body !== "object") return NextResponse.json({ error: "Requete invalide." }, { status: 400 });
    const data = body as { url?: unknown; strategy?: unknown };
    if (typeof data.url !== "string" || data.url.length > 2048) return NextResponse.json({ error: "URL invalide." }, { status: 400 });
    let url: URL;
    try { url = new URL(data.url); } catch { return NextResponse.json({ error: "URL invalide." }, { status: 400 }); }
    if (url.protocol !== "https:" || url.hostname.toLowerCase() !== "example.com" || url.username || url.password || url.port || url.pathname !== "/" || url.search) {
      return NextResponse.json({ error: "Mode test : seule l'URL https://example.com est autorisee." }, { status: 403 });
    }
    const strategy: Strategy = data.strategy === "desktop" ? "desktop" : "mobile";
    const secret = process.env.AUDIT_HASH_SECRET;
    if (!secret) throw new Error("AUDIT_HASH_SECRET manquant");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const requester_hash = createHmac("sha256", secret).update(ip).digest("hex");
    const client = db();
    // Protection simple pour le test. Une limitation atomique en base sera necessaire en production.
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: countError } = await client.from("audit_jobs").select("id", { count: "exact", head: true }).eq("requester_hash", requester_hash).gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return NextResponse.json({ error: "Limite de 5 analyses par heure atteinte." }, { status: 429 });
    const { count: queued, error: queueError } = await client.from("audit_jobs").select("id", { count: "exact", head: true }).in("status", ["pending", "running"]);
    if (queueError) throw queueError;
    if ((queued ?? 0) >= 20) return NextResponse.json({ error: "File d'attente pleine. Reessayez plus tard." }, { status: 503 });
    const { data: job, error } = await client.from("audit_jobs").insert({ url: "https://example.com", strategy, status: "pending", requester_hash }).select("id").single();
    if (error || !job) throw error ?? new Error("Creation impossible");
    return NextResponse.json({ jobId: job.id, status: "pending" }, { status: 202 });
  } catch (e) {
    console.error("Audit enqueue failed", e);
    return NextResponse.json({ error: "Impossible de creer la demande d'analyse." }, { status: 500 });
  }
}
