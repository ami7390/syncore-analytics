import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const statuses = ["todo", "in_progress", "done", "blocked"];
const categories = ["fix", "improvement", "deployment", "maintenance", "other"];
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function payload(req: NextRequest): Promise<Record<string, unknown> | null> {
  try { const value: unknown = await req.json(); return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : null; }
  catch { return null; }
}
export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return reply({ error: "Accès réservé à l'Administrateur principal" }, 403);
  const siteId = req.nextUrl.searchParams.get("siteId");
  if (siteId && !uuid.test(siteId)) return reply({ error: "Site invalide" }, 400);
  const db = adminService();
  const { data: sites, error: siteError } = await db.from("monitored_sites").select("id,name,url").order("name");
  if (siteError) return reply({ error: "Lecture des projets impossible" }, 500);
  let query = db.from("project_journal").select("id,site_id,title,details,status,category,created_at,updated_at,completed_at").order("created_at", { ascending: false }).limit(300);
  if (siteId) query = query.eq("site_id", siteId);
  const { data, error } = await query;
  if (error) return reply({ error: "Lecture du journal impossible. Migration 006 exécutée ?" }, 500);
  return reply({ sites: sites ?? [], entries: data ?? [] });
}
export async function POST(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return reply({ error: "Accès réservé à l'Administrateur principal" }, 403);
  const body = await payload(req);
  const siteId = body?.siteId;
  const title = typeof body?.title === "string" ? body.title.trim() : "";
  const details = typeof body?.details === "string" ? body.details.trim() : "";
  const status = body?.status ?? "todo";
  const category = body?.category ?? "improvement";
  if (typeof siteId !== "string" || !uuid.test(siteId) || title.length < 3 || title.length > 160 || details.length > 5000 || !statuses.includes(String(status)) || !categories.includes(String(category))) return reply({ error: "Informations invalides" }, 400);
  const db = adminService();
  const { data: site, error: siteError } = await db.from("monitored_sites").select("id").eq("id", siteId).maybeSingle();
  if (siteError || !site) return reply({ error: "Projet introuvable" }, 404);
  const now = new Date().toISOString();
  const { error } = await db.from("project_journal").insert({ site_id: siteId, title, details, status, category, created_by: access.user.id, completed_at: status === "done" ? now : null });
  if (error) { console.error("[Syncore Journal] Création", error.code); return reply({ error: "Enregistrement impossible" }, 500); }
  return reply({ ok: true }, 201);
}
export async function PATCH(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return reply({ error: "Accès réservé à l'Administrateur principal" }, 403);
  const body = await payload(req);
  if (typeof body?.id !== "string" || !uuid.test(body.id) || typeof body.status !== "string" || !statuses.includes(body.status)) return reply({ error: "Statut ou identifiant invalide" }, 400);
  const db = adminService();
  const { data: previous, error: readError } = await db.from("project_journal").select("status,completed_at").eq("id", body.id).maybeSingle();
  if (readError || !previous) return reply({ error: "Entrée introuvable" }, 404);
  const completed_at = body.status === "done" ? (previous.status === "done" ? previous.completed_at ?? new Date().toISOString() : new Date().toISOString()) : null;
  const { error } = await db.from("project_journal").update({ status: body.status, completed_at, updated_at: new Date().toISOString() }).eq("id", body.id);
  if (error) return reply({ error: "Mise à jour impossible" }, 500);
  return reply({ ok: true });
}
