import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });

async function session() {
  const supabase = await supabaseServer();
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  const { data: member } = await supabase.from("admin_users").select("active,role").eq("user_id", user.id).maybeSingle();
  if (!member?.active || !["owner", "admin", "director"].includes(member.role)) return null;
  return { supabase, role: member.role };
}

export async function GET() {
  const actor = await session();
  if (!actor) return reply({ error: "Connexion requise" }, 401);
  const [{ data: factors, error: factorError }, { data: assurance, error: assuranceError }] = await Promise.all([
    actor.supabase.auth.mfa.listFactors(), actor.supabase.auth.mfa.getAuthenticatorAssuranceLevel(),
  ]);
  if (factorError || assuranceError) return reply({ error: "MFA indisponible" }, 503);
  return reply({ role: actor.role, currentLevel: assurance?.currentLevel, factors: (factors?.totp ?? []).filter(f => f.status === "verified").map(f => ({ id: f.id, friendlyName: f.friendly_name })) });
}

export async function POST(req: NextRequest) {
  const actor = await session();
  if (!actor) return reply({ error: "Connexion requise" }, 401);
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch { return reply({ error: "Requete invalide" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body)) return reply({ error: "Requete invalide" }, 400);
  if (body.action === "enroll") {
    const { data: factors } = await actor.supabase.auth.mfa.listFactors();
    if ((factors?.totp ?? []).some(f => f.status === "verified")) return reply({ error: "Facteur deja configure" }, 409);
    const { data, error } = await actor.supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Syncore Analytics" });
    if (error || !data?.totp) return reply({ error: "Enrolement impossible" }, 400);
    return reply({ factorId: data.id, qrCode: data.totp.qr_code, secret: data.totp.secret });
  }
  if (body.action === "verify") {
    const factorId = body.factorId;
    const code = body.code;
    if (typeof factorId !== "string" || !/^[a-zA-Z0-9-]{10,100}$/.test(factorId) || typeof code !== "string" || !/^\d{6}$/.test(code)) return reply({ error: "Code invalide" }, 400);
    const { data: challenge, error: challengeError } = await actor.supabase.auth.mfa.challenge({ factorId });
    if (challengeError || !challenge) return reply({ error: "Verification impossible" }, 400);
    const { error } = await actor.supabase.auth.mfa.verify({ factorId, challengeId: challenge.id, code });
    if (error) return reply({ error: "Code incorrect ou expire" }, 401);
    return reply({ ok: true, role: actor.role });
  }
  return reply({ error: "Action inconnue" }, 400);
}
