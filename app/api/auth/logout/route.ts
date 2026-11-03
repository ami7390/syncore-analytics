import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextRequest, NextResponse } from "next/server";
import { supabasePublicConfig } from "@/lib/supabase/config";

export const runtime = "nodejs";
export async function POST(request: NextRequest) {
  const { url, key } = supabasePublicConfig();
  const response = NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() { return request.cookies.getAll(); },
      setAll(items: { name: string; value: string; options?: CookieOptions }[]) { items.forEach(({ name, value, options }) => response.cookies.set(name, value, options)); },
    },
  });
  const { error } = await supabase.auth.signOut();
  if (error) return NextResponse.json({ error: "Déconnexion impossible." }, { status: 500 });
  return response;
}
