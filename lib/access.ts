import { currentDevice, devicesRequired } from "@/lib/devices";

import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";

export type Role = "owner" | "admin" | "director";

export async function getIdentity() {
  const supabase = await supabaseServer();

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    console.error("[Syncore Auth] Session invalide", {
      reason: authError?.message ?? "Utilisateur introuvable",
    });
    return null;
  }

  const { data, error } = await supabase
    .from("admin_users")
    .select("role, active")
    .eq("user_id", user.id)
    .maybeSingle();

  if (error) {
    console.error("[Syncore Auth] Lecture du role impossible", {
      code: error.code,
      message: error.message,
    });
    return null;
  }

  if (!data) {
    console.error("[Syncore Auth] Aucun role associe");
    return null;
  }

  if (
    data.active !== true ||
    !["owner", "admin", "director"].includes(data.role)
  ) {
    console.error("[Syncore Auth] Role ou statut invalide", {
      role: data.role,
      active: data.active,
    });
    return null;
  }

  // MFA is enabled only after the owner has enrolled and verified a factor.
  // Set REQUIRE_MFA=true in Vercel only after testing the enrollment flow.
  if ((process.env.REQUIRE_MFA === "true" || devicesRequired())) {
    const { data: assurance, error: assuranceError } =
      await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    if (assuranceError || assurance?.currentLevel !== "aal2") return null;
  }

  return {
    user,
    role: data.role as Role,
  };
}

export async function getAccess() {
  const identity = await getIdentity();
  if (!identity || !devicesRequired()) return identity;
  try { return (await currentDevice(identity.user.id))?.status === "approved" ? identity : null; }
  catch { return null; }
}

export async function requireAccess() {
  const access = await getAccess();

  if (!access) {
    if (devicesRequired() && await getIdentity()) redirect("/appareil");
    redirect("/non-autorise");
  }

  return access;
}
