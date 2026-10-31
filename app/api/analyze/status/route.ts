import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import type { AuditResult } from "@/lib/pagespeed";

export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id") || "";
  if (!uuid.test(id)) return NextResponse.json({ error: "Identifiant invalide." }, { status: 400 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return NextResponse.json({ error: "Service indisponible." }, { status: 503 });
  const db = createClient(url, key, { auth: { persistSession: false } });
  const { data, error } = await db.from("audit_jobs").select("status,result").eq("id", id).single();
  if (error || !data) return NextResponse.json({ error: "Analyse introuvable." }, { status: 404 });
  if (data.status === "completed") return NextResponse.json({ status: "completed", result: data.result as AuditResult });
  if (data.status === "failed") return NextResponse.json({ status: "failed", error: "L'analyse a echoue. Reessayez plus tard." });
  return NextResponse.json({ status: data.status });
}
