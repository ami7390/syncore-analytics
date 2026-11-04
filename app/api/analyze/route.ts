import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { createHmac } from "node:crypto";
import { isIP } from "node:net";
import { getAccess } from "@/lib/access";
import type { Strategy } from "@/lib/pagespeed";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function db() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Configuration Supabase manquante");
  return createClient(url, key, { auth: { persistSession: false } });
}

function parseUrl(value: unknown): string | null {
  if (typeof value !== "string" || value.length > 2048) return null;
  try {
    const u = new URL(value.trim());
    if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash ||
        isIP(u.hostname) || !u.hostname.includes(".") || u.hostname === "localhost") return null;
    return u.toString();
  } catch {
    return null;
  }
}

function reply(error: string, status: number) {
  return NextResponse.json({ error }, { status, headers: { "Cache-Control": "no-store" } });
}

export async function POST(req: NextRequest) {
  try {
    const actor = await getAccess();
    if (!actor) return reply("Connexion requise.", 401);
    if (actor.role === "director") return reply("Acces en lecture seule.", 403);

    let body: unknown;
    try { body = await req.json(); } catch { return reply("Requete invalide.", 400); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return reply("Requete invalide.", 400);
    const data = body as { url?: unknown; strategy?: unknown };
    const url = parseUrl(data.url);
    if (!url) return reply("URL HTTPS invalide.", 400);
    if (data.strategy !== undefined && data.strategy !== "mobile" && data.strategy !== "desktop") {
      return reply("Strategie invalide.", 400);
    }
    const strategy: Strategy = data.strategy === "desktop" ? "desktop" : "mobile";
    const client = db();

    // Only active sites explicitly registered in the administration are eligible.
    const { data: site, error: siteError } = await client.from("monitored_sites")
      .select("id").eq("url", url).eq("active", true).maybeSingle();
    if (siteError) throw siteError;
    if (!site) return reply("Ce site n'est pas enregistre ou est inactif.", 403);

    // Administrators can only request audits for their assigned sites.
    if (actor.role === "admin") {
      const { data: assignment, error: assignmentError } = await client.from("site_assignments")
        .select("site_id").eq("site_id", site.id).eq("user_id", actor.user.id).maybeSingle();
      if (assignmentError) throw assignmentError;
      if (!assignment) return reply("Ce site ne vous est pas attribue.", 403);
    }

    const secret = process.env.AUDIT_HASH_SECRET;
    if (!secret) throw new Error("AUDIT_HASH_SECRET manquant");
    const requester_hash = createHmac("sha256", secret).update(actor.user.id).digest("hex");
    const since = new Date(Date.now() - 3600_000).toISOString();
    const { count, error: countError } = await client.from("audit_jobs")
      .select("id", { count: "exact", head: true })
      .eq("requester_hash", requester_hash).gte("created_at", since);
    if (countError) throw countError;
    if ((count ?? 0) >= 5) return reply("Limite de 5 analyses par heure atteinte.", 429);

    const { count: queued, error: queueError } = await client.from("audit_jobs")
      .select("id", { count: "exact", head: true }).in("status", ["pending", "running"]);
    if (queueError) throw queueError;
    if ((queued ?? 0) >= 20) return reply("File d'attente pleine. Reessayez plus tard.", 503);

    const { data: job, error } = await client.from("audit_jobs")
      .insert({ url, strategy, status: "pending", requester_hash })
      .select("id").single();
    if (error || !job) throw error ?? new Error("Creation impossible");
    return NextResponse.json({ jobId: job.id, status: "pending" }, { status: 202 });
  } catch (error) {
    console.error("Audit enqueue failed", error);
    return reply("Impossible de creer la demande d'analyse.", 500);
  }
}
