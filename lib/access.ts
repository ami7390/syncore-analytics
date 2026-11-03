import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "director";
export async function getAccess() {
  const supabase = await supabaseServer();
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) return null;
  const { data, error } = await supabase.from("admin_users")
    .select("role,active").eq("user_id", user.id).maybeSingle();
  if (error || !data?.active || !["owner", "admin", "director"].includes(data.role)) return null;
  return { user, role: data.role as Role };
}
export async function requireAccess() {
  const access = await getAccess();
  if (!access) redirect("/non-autorise");
  return access;
}
