import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
import { clarity, ga4, searchConsole, siteConfig } from "@/lib/integrations/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET(req: NextRequest) {
  const access = await getAccess();
  if (!access) return reply({ error: "Authentification requise" }, 401);
  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");
  if (!uuid.test(siteId) || !["ga4", "search-console", "clarity"].includes(provider) || ![7, 30, 90].includes(days)) return reply({ error: "Paramètres invalides" }, 400);
  const db = adminService();
  const { data: site, error } = await db.from("monitored_sites").select("id,name,url,active").eq("id", siteId).maybeSingle();
  if (error || !site) return reply({ error: "Site introuvable" }, 404);
  if (access.role === "admin") {
    const { data: assignment, error: assignmentError } = await db.from("site_assignments").select("site_id").eq("site_id", siteId).eq("user_id", access.user.id).maybeSingle();
    if (assignmentError || !assignment) return reply({ error: "Site non attribué" }, 403);
  }
  let config;
  try { config = siteConfig(siteId); } catch { return reply({ error: "Configuration des intégrations invalide" }, 500); }
  const configured = { ga4: !!config.ga4PropertyId, searchConsole: !!config.searchConsoleSiteUrl, clarity: !!config.clarityTokenEnv };
  if (req.nextUrl.searchParams.get("status") === "1") return reply({ site, configured });
  try {
    if (provider === "ga4") {
      if (!config.ga4PropertyId) return reply({ error: "GA4 non configuré pour ce site" }, 409);
      return reply({ provider, days, data: await ga4(config.ga4PropertyId, days) });
    }
    if (provider === "search-console") {
      if (!config.searchConsoleSiteUrl) return reply({ error: "Search Console non configurée pour ce site" }, 409);
      return reply({ provider, days, data: await searchConsole(config.searchConsoleSiteUrl, days) });
    }
    if (!config.clarityTokenEnv || !/^CLARITY_TOKEN_[A-Z0-9_]+$/.test(config.clarityTokenEnv)) return reply({ error: "Clarity non configuré pour ce site" }, 409);
    const token = process.env[config.clarityTokenEnv];
    if (!token) return reply({ error: "Jeton Clarity manquant côté serveur" }, 409);
    return reply({ provider, days, data: await clarity(token) });
  } catch (cause) {
    console.error("[Syncore Integrations]", provider, siteId, cause instanceof Error ? cause.message : "Erreur");
    return reply({ error: "Impossible de récupérer les données. Vérifiez la configuration et les autorisations du fournisseur." }, 502);
  }
}
