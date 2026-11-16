import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const monthPattern = /^\d{4}-(0[1-9]|1[0-2])$/;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (!access || (access.role !== "owner" && access.role !== "director")) return reply({ error: "Accès refusé" }, 403);
  const db = adminService();
  let query = db.from("monthly_reports").select("id,site_id,report_month,description,snapshot,status,captured_at,published_at,updated_at").order("report_month", { ascending: false }).limit(150);
  if (access.role === "director") query = query.eq("status", "published");
  const [{ data: reports, error }, { data: sites, error: sitesError }] = await Promise.all([
    query,
    db.from("monitored_sites").select("id,name,url").order("name"),
  ]);
  if (error || sitesError) return reply({ error: "Lecture impossible. Vérifiez la migration monthly_reports.sql." }, 500);
  return reply({ reports: reports ?? [], sites: sites ?? [] });
}

export async function POST(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return reply({ error: "Réservé à l'Administrateur principal" }, 403);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "JSON invalide" }, 400); }
  const siteId = body.siteId;
  const month = body.month;
  const description = body.description;
  const integrations = body.integrations;
  if (typeof siteId !== "string" || !uuid.test(siteId) || typeof month !== "string" || !monthPattern.test(month) || typeof description !== "string" || description.length > 10000 || !integrations || typeof integrations !== "object" || Array.isArray(integrations)) return reply({ error: "Informations invalides" }, 400);
  const nowMonth = new Date().toISOString().slice(0, 7);
  // Les API GA4/GSC renvoient une fenêtre glissante et Clarity 3 jours.
  // Ne pas fabriquer de rapports historiques à partir de mesures actuelles.
  if (month !== nowMonth) return reply({ error: "La capture des intégrations est disponible pour le mois courant uniquement. Les anciens mois nécessitent des données archivées." }, 400);
  const payload = integrations as Record<string, unknown>;
  if (JSON.stringify(payload).length > 300000) return reply({ error: "Capture trop volumineuse" }, 413);
  const db = adminService();
  const { data: site } = await db.from("monitored_sites").select("id").eq("id", siteId).maybeSingle();
  if (!site) return reply({ error: "Site inconnu" }, 404);
  const { data: previous, error: prevError } = await db.from("monthly_reports").select("id,status").eq("site_id", siteId).eq("report_month", month).maybeSingle();
  if (prevError) return reply({ error: "Lecture impossible" }, 500);
  if (previous?.status === "published") return reply({ error: "Rapport déjà publié : il ne peut plus être modifié." }, 409);
  const start = `${month}-01`;
  const next = new Date(`${start}T00:00:00Z`);
  next.setUTCMonth(next.getUTCMonth() + 1);
  const end = next.toISOString().slice(0, 10);
  const [{ data: audits, error: auditsError }, { data: entries, error: journalError }] = await Promise.all([
    db.from("daily_reports").select("report_date,content").eq("site_id", siteId).gte("report_date", start).lt("report_date", end).order("report_date", { ascending: true }).limit(50),
    db.from("project_journal").select("title,details,category,completed_at").eq("site_id", siteId).eq("status", "done").gte("completed_at", `${start}T00:00:00Z`).lt("completed_at", `${end}T00:00:00Z`).order("completed_at", { ascending: true }).limit(200),
  ]);
  if (auditsError || journalError) return reply({ error: "Lecture Lighthouse ou journal impossible" }, 500);
  const capturedAt = new Date().toISOString();
  const snapshot = { integrations: payload, lighthouse: audits ?? [], interventions: entries ?? [], capturedAt, windows: { ga4: "30 derniers jours à la capture", gsc: "30 derniers jours à la capture", clarity: "3 derniers jours à la capture", lighthouse: `Mois ${month}`, interventions: `Mois ${month}` } };
  const record = { site_id: siteId, report_month: month, description, snapshot, status: "draft", captured_at: capturedAt, updated_at: capturedAt };
  const { error } = previous
    ? await db.from("monthly_reports").update(record).eq("id", previous.id).eq("status", "draft")
    : await db.from("monthly_reports").insert(record);
  if (error) return reply({ error: "Enregistrement impossible" }, 500);
  return reply({ ok: true });
}

export async function PATCH(req: NextRequest) {
  const access = await getAccess();
  if (access?.role !== "owner") return reply({ error: "Accès refusé" }, 403);
  let body: { id?: unknown };
  try { body = await req.json(); } catch { return reply({ error: "JSON invalide" }, 400); }
  if (typeof body.id !== "string" || !uuid.test(body.id)) return reply({ error: "Identifiant invalide" }, 400);
  const db = adminService();
  const { data: record, error: readError } = await db.from("monthly_reports").select("id,description,snapshot").eq("id", body.id).eq("status", "draft").maybeSingle();
  if (readError || !record) return reply({ error: "Brouillon introuvable" }, 404);
  if (!record.description.trim()) return reply({ error: "Ajoutez une description des travaux avant publication" }, 400);
  const { data, error } = await db.from("monthly_reports").update({ status: "published", published_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", body.id).eq("status", "draft").select("id").maybeSingle();
  if (error || !data) return reply({ error: "Publication impossible" }, 500);
  return reply({ ok: true });
}
