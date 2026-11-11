import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return NextResponse.json({ error: "Accès réservé à l'Administrateur principal" }, { status: 403, headers: { "Cache-Control": "no-store" } });
  const siteId = req.nextUrl.searchParams.get("siteId");
  if (siteId && !uuid.test(siteId)) return NextResponse.json({ error: "Projet invalide" }, { status: 400 });
  const db = adminService();
  const { data: sites, error: siteError } = await db.from("monitored_sites").select("id,name,url").order("name");
  if (siteError) return NextResponse.json({ error: "Lecture des projets impossible" }, { status: 500 });
  let query = db.from("daily_reports").select("id,site_id,report_date,generated_at,content").order("report_date", { ascending: false }).limit(100);
  if (siteId) query = query.eq("site_id", siteId);
  const { data: reports, error } = await query;
  if (error) return NextResponse.json({ error: "Lecture des rapports impossible. Migration 007 exécutée ?" }, { status: 500 });
  return NextResponse.json({ sites: sites ?? [], reports: reports ?? [] }, { headers: { "Cache-Control": "no-store" } });
}
