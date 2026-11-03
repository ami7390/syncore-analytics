import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
export const runtime = "nodejs";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export async function PUT(req: NextRequest) {
 const actor = await getAccess();
 if (actor?.role !== "owner") return NextResponse.json({ error: "Accès réservé à l'Admin principal" }, { status: 403 });
 let input: unknown;
 try { input = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
 if (!input || typeof input !== "object") return NextResponse.json({ error: "Données invalides" }, { status: 400 });
 const { siteId, userIds } = input as { siteId?: unknown; userIds?: unknown };
 if (typeof siteId !== "string" || !uuid.test(siteId) || !Array.isArray(userIds) || userIds.length > 100 || userIds.some(x => typeof x !== "string" || !uuid.test(x))) return NextResponse.json({ error: "Affectations invalides" }, { status: 400 });
 const ids = [...new Set(userIds as string[])]; const db = adminService();
 const { data: site, error: siteError } = await db.from("monitored_sites").select("id").eq("id", siteId).maybeSingle();
 if (siteError || !site) return NextResponse.json({ error: "Site introuvable" }, { status: 404 });
 if (ids.length) {
  const { data, error } = await db.from("admin_users").select("user_id").in("user_id", ids).eq("role", "admin").eq("active", true);
  if (error || (data ?? []).length !== ids.length) return NextResponse.json({ error: "Sélectionnez uniquement des administrateurs actifs" }, { status: 400 });
 }
 // Replacing assignments is owner-only; restore old assignments if insertion fails.
 const { data: previous, error: previousError } = await db.from("site_assignments").select("user_id").eq("site_id", siteId);
 if (previousError) return NextResponse.json({ error: "Lecture impossible" }, { status: 500 });
 const { error: deleteError } = await db.from("site_assignments").delete().eq("site_id", siteId);
 if (deleteError) return NextResponse.json({ error: "Affectation impossible" }, { status: 500 });
 if (ids.length) {
  const { error } = await db.from("site_assignments").insert(ids.map(user_id => ({ site_id: siteId, user_id })));
  if (error) {
   if ((previous ?? []).length) await db.from("site_assignments").upsert((previous ?? []).map(x => ({ site_id: siteId, user_id: x.user_id })));
   return NextResponse.json({ error: "Affectation impossible, réessayez" }, { status: 500 });
  }
 }
 return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
}
