import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "no-store" };
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function reply(body: object, status = 200) { return NextResponse.json(body, { status, headers }); }
function validUrl(raw: unknown): string | null {
 if (typeof raw !== "string" || raw.length > 2048) return null;
 try { const u = new URL(raw.trim()); if (u.protocol !== "https:" || !u.hostname.includes(".") || u.username || u.password || u.port || u.hash) return null; return u.toString(); } catch { return null; }
}
async function bodyOf(req: NextRequest): Promise<Record<string, unknown> | null> {
 try { const v: unknown = await req.json(); return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : null; } catch { return null; }
}
export async function GET() {
 const actor = await getAccess(); if (!actor) return reply({ error: "Non autorisé" }, 401);
 const db = adminService();
 let allowed: string[] | null = null;
 if (actor.role === "admin") {
  const { data, error } = await db.from("site_assignments").select("site_id").eq("user_id", actor.user.id);
  if (error) return reply({ error: "Lecture des affectations impossible" }, 500);
  allowed = (data ?? []).map(x => x.site_id as string);
  if (!allowed.length) return reply({ sites: [], administrators: [] });
 }
 let query = db.from("monitored_sites").select("id,name,url,description,active,created_at").order("created_at", { ascending: false });
 if (allowed) query = query.in("id", allowed);
 const { data: sites, error } = await query;
 if (error) return reply({ error: "Lecture des sites impossible. Migration 004 exécutée ?" }, 500);
 const ids = (sites ?? []).map(x => x.id);
 const { data: assignments, error: assignError } = ids.length ? await db.from("site_assignments").select("site_id,user_id").in("site_id", ids) : { data: [], error: null };
 if (assignError) return reply({ error: "Lecture des affectations impossible" }, 500);
 const result = (sites ?? []).map(s => ({ ...s, assigned_user_ids: (assignments ?? []).filter(a => a.site_id === s.id).map(a => a.user_id) }));
 if (actor.role !== "owner") return reply({ sites: result, administrators: [] });
 const { data: members, error: memberError } = await db.from("admin_users").select("user_id,role,active").eq("role", "admin").eq("active", true);
 if (memberError) return reply({ error: "Lecture des administrateurs impossible" }, 500);
 const administrators = await Promise.all((members ?? []).map(async m => {
  const { data } = await db.auth.admin.getUserById(m.user_id);
  return { id: m.user_id, email: data.user?.email ?? "Administrateur" };
 }));
 return reply({ sites: result, administrators });
}
export async function POST(req: NextRequest) {
 const actor = await getAccess(); if (actor?.role !== "owner") return reply({ error: "Accès réservé à l'Admin principal" }, 403);
 const body = await bodyOf(req); const url = validUrl(body?.url);
 const name = typeof body?.name === "string" ? body.name.trim() : "";
 const description = typeof body?.description === "string" ? body.description.trim() : "";
 if (!url || name.length < 2 || name.length > 120 || description.length > 1000) return reply({ error: "Nom, URL HTTPS ou description invalide" }, 400);
 const { data, error } = await adminService().from("monitored_sites").insert({ name, url, description }).select("id").single();
 if (error) return reply({ error: error.code === "23505" ? "Ce site existe déjà" : "Création du site impossible" }, error.code === "23505" ? 409 : 500);
 return reply({ id: data.id }, 201);
}
export async function PATCH(req: NextRequest) {
 const actor = await getAccess(); if (!actor || actor.role === "director") return reply({ error: "Accès refusé" }, 403);
 const body = await bodyOf(req); const id = body?.id;
 if (typeof id !== "string" || !uuid.test(id)) return reply({ error: "Identifiant invalide" }, 400);
 const db = adminService();
 if (actor.role === "admin") {
  const { data, error } = await db.from("site_assignments").select("site_id").eq("site_id", id).eq("user_id", actor.user.id).maybeSingle();
  if (error || !data) return reply({ error: "Site non attribué" }, 403);
 }
 const changes: Record<string, string | boolean> = {};
 if (body?.name !== undefined) { if (typeof body.name !== "string" || body.name.trim().length < 2 || body.name.trim().length > 120) return reply({ error: "Nom invalide" }, 400); changes.name = body.name.trim(); }
 if (body?.description !== undefined) { if (typeof body.description !== "string" || body.description.length > 1000) return reply({ error: "Description invalide" }, 400); changes.description = body.description.trim(); }
 if (body?.url !== undefined) { const url = validUrl(body.url); if (!url) return reply({ error: "URL HTTPS invalide" }, 400); changes.url = url; }
 if (body?.active !== undefined) { if (actor.role !== "owner" || typeof body.active !== "boolean") return reply({ error: "Seul l'Admin principal peut désactiver un site" }, 403); changes.active = body.active; }
 if (!Object.keys(changes).length) return reply({ error: "Aucune modification" }, 400);
 const { data, error } = await db.from("monitored_sites").update({ ...changes, updated_at: new Date().toISOString() }).eq("id", id).select("id").maybeSingle();
 if (error || !data) return reply({ error: "Modification impossible" }, 500);
 return reply({ ok: true });
}
