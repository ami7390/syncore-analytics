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
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items) {
        items.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return NextResponse.json({ error: "Identifiants invalides ou compte non autorisé." }, { status: 401, headers: { "Cache-Control": "no-store" } });
  return response;
}
