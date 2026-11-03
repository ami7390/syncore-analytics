import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { supabasePublicConfig } from "@/lib/supabase/config";

export async function supabaseServer() {
  const cookieStore = await cookies();
  const { url, key } = supabasePublicConfig();
  return createServerClient(url, key, {
    cookies: {
      getAll() { return cookieStore.getAll(); },
      setAll(items) {
        try {
          items.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        } catch {
          // A Server Component cannot always write cookies; middleware refreshes them.
        }
      },
    },
  });
}
