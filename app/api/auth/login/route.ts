import type { CookieOptions } from "@supabase/ssr";
import { createServerClient } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabasePublicConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  let body: unknown;
  try { body = await request.json(); }
  catch { return NextResponse.json({ error: "Requête invalide." }, { status: 400 }); }
  if (!body || typeof body !== "object") return NextResponse.json({ error: "Requête invalide." }, { status: 400 });
  const { email, password } = body as Record<string, unknown>;
  if (typeof email !== "string" || typeof password !== "string" || email.length > 254 || password.length > 1024) {
    return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
  }
  const { url, key } = supabasePublicConfig();
  const response = NextResponse.json({ ok: true, role: "admin" }, { headers: { "Cache-Control": "no-store" } });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items: { name: string; value: string; options?: CookieOptions }[]) {
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { data: signIn, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: "Identifiants invalides ou compte non autorisé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  if (!signIn.user) return NextResponse.json({ error: "Compte non autorisé." }, { status: 403 });
  const { data: member, error: roleError } = await supabase.from("admin_users")
    .select("role,active").eq("user_id", signIn.user.id).maybeSingle();
  if (roleError || !member || member.active !== true || !["owner", "admin", "director"].includes(member.role)) {
    return NextResponse.json({ error: "Compte non autorisé." }, { status: 403, headers: { "Cache-Control": "no-store" } });
  }
  const { data: assurance, error: assuranceError } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assuranceError) return NextResponse.json({ error: "Verification de securite indisponible." }, { status: 503 });
  const mfaRequired = process.env.REQUIRE_MFA === "true";
  const needsMfa = mfaRequired && assurance?.currentLevel !== "aal2";
  // Preserve the session cookies already set on the response.
  const result = NextResponse.json({ ok: true, role: member.role, needsMfa }, { headers: { "Cache-Control": "no-store" } });
  response.cookies.getAll().forEach(cookie => result.cookies.set(cookie));
  return result;
}
