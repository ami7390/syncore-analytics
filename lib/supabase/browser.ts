import { createBrowserClient } from "@supabase/ssr";
import { supabasePublicConfig } from "@/lib/supabase/config";

export function supabaseBrowser() {
  const { url, key } = supabasePublicConfig();
  return createBrowserClient(url, key);
}
