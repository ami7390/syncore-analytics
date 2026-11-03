import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
export const runtime = "nodejs";
const noStore = { "Cache-Control": "no-store" };
async function authorized() { const a = await getAccess(); return a?.role === "owner" ? a : null; }
export async function POST(req: NextRequest) {
  if (!await authorized()) return NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: noStore });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const { email, password, role } = input as Record<string, unknown>;
  if (typeof email !== "string" || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || typeof password !== "string" || password.length < 12 || password.length > 128 || (role !== "admin" && role !== "director")) {
    return NextResponse.json({ error: "Email, mot de passe (12 caractères minimum) ou rôle invalide" }, { status: 400 });
  }
  try {
    const db = adminService();
    const { data, error } = await db.auth.admin.createUser({ email: email.trim().toLowerCase(), password, email_confirm: true });
    if (error || !data.user) return NextResponse.json({ error: "Création impossible : vérifiez que l'email n'est pas déjà utilisé." }, { status: 409 });
    const { error: insertError } = await db.from("admin_users").insert({ user_id: data.user.id, role, active: true });
    if (insertError) {
      const { error: rollbackError } = await db.auth.admin.deleteUser(data.user.id);
      if (rollbackError) console.error("Rollback utilisateur échoué", data.user.id);
      return NextResponse.json({ error: "Attribution du rôle impossible. Réessayez." }, { status: 500 });
    }
    return NextResponse.json({ user: { user_id: data.user.id, email: data.user.email, role, active: true } }, { status: 201, headers: noStore });
  } catch (e) { console.error("Create user failed", e); return NextResponse.json({ error: "Erreur serveur" }, { status: 500 }); }
}
export async function PATCH(req: NextRequest) {
  const actor = await authorized();
  if (!actor) return NextResponse.json({ error: "Accès refusé" }, { status: 403, headers: noStore });
  let input: unknown;
  try { input = await req.json(); } catch { return NextResponse.json({ error: "JSON invalide" }, { status: 400 }); }
  if (!input || typeof input !== "object") return NextResponse.json({ error: "Données invalides" }, { status: 400 });
  const { userId, role, active } = input as Record<string, unknown>;
  if (typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId) || (role !== "admin" && role !== "director") || typeof active !== "boolean" || userId === actor.user.id) return NextResponse.json({ error: "Modification interdite" }, { status: 400 });
  try {
    const db = adminService();
    const { data: target, error: lookupError } = await db.from("admin_users").select("role").eq("user_id", userId).maybeSingle();
    if (lookupError || !target || target.role === "owner") return NextResponse.json({ error: "Compte non modifiable" }, { status: 403 });
    const { error } = await db.from("admin_users").update({ role, active, updated_at: new Date().toISOString() }).eq("user_id", userId).neq("role", "owner");
    if (error) throw error;
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (e) { console.error("Update user failed", e); return NextResponse.json({ error: "Erreur serveur" }, { status: 500 }); }
}
