import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
import { clarity, ga4, searchConsole, siteConfig } from "@/lib/integrations/providers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const CLARITY_TTL_MS = 24 * 60 * 60 * 1000;
const CLARITY_RETRY_MS = 60 * 60 * 1000;

type ClarityCacheRow = {
  data: unknown | null;
  cached_at: string | null;
  next_attempt_at: string;
  lease_until: string;
};

const reply = (body: object, status = 200) =>
  NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });

function cacheReply(row: ClarityCacheRow, state: "fresh" | "stale") {
  return reply({
    provider: "clarity",
    days: 3,
    data: row.data,
    cache: { state, cachedAt: row.cached_at },
  });
}

function isFresh(row: ClarityCacheRow | null): boolean {
  if (!row?.cached_at || row.data == null) return false;
  const timestamp = Date.parse(row.cached_at);
  return Number.isFinite(timestamp) && Date.now() - timestamp < CLARITY_TTL_MS;
}

function isFuture(value: string | null | undefined): boolean {
  return !!value && Date.parse(value) > Date.now();
}

export async function GET(req: NextRequest) {
  const access = await getAccess();

  if (!access) {
    return reply({ error: "Authentification requise" }, 401);
  }

  const siteId = req.nextUrl.searchParams.get("siteId") ?? "";
  const provider = req.nextUrl.searchParams.get("provider") ?? "";
  const days = Number(req.nextUrl.searchParams.get("days") ?? "30");

  if (
    !uuid.test(siteId) ||
    !["ga4", "search-console", "clarity"].includes(provider) ||
    ![7, 30, 90].includes(days)
  ) {
    return reply({ error: "Paramètres invalides" }, 400);
  }

  const db = adminService();

  const { data: site, error } = await db
    .from("monitored_sites")
    .select("id,name,url,active")
    .eq("id", siteId)
    .maybeSingle();

  if (error || !site) {
    return reply({ error: "Site introuvable" }, 404);
  }

  if (access.role === "admin") {
    const { data: assignment, error: assignmentError } = await db
      .from("site_assignments")
      .select("site_id")
      .eq("site_id", siteId)
      .eq("user_id", access.user.id)
      .maybeSingle();

    if (assignmentError || !assignment) {
      return reply({ error: "Site non attribué" }, 403);
    }
  }

  let config;

  try {
    config = siteConfig(siteId);
  } catch {
    return reply({ error: "Configuration des intégrations invalide" }, 500);
  }

  const configured = {
    ga4: !!config.ga4PropertyId,
    searchConsole: !!config.searchConsoleSiteUrl,
    clarity: !!config.clarityTokenEnv,
  };

  if (req.nextUrl.searchParams.get("status") === "1") {
    return reply({ site, configured });
  }

  // Diagnostic temporaire : réservé aux utilisateurs autorisés.
  // Ne révèle aucune clé privée ni aucun jeton d'accès.
  if (req.nextUrl.searchParams.get("diagnostic") === "1") {
    if (provider !== "search-console") {
      return reply({ error: "Diagnostic réservé à Search Console" }, 400);
    }

    return reply({
      site: {
        id: site.id,
        name: site.name,
        url: site.url,
      },
      searchConsole: {
        configured: !!config.searchConsoleSiteUrl,
        propertyUrl: config.searchConsoleSiteUrl ?? null,
      },
    });
  }

  try {
    if (provider === "ga4") {
      if (!config.ga4PropertyId) {
        return reply({ error: "GA4 non configuré pour ce site" }, 409);
      }

      return reply({
        provider,
        days,
        data: await ga4(config.ga4PropertyId, days),
      });
    }

    if (provider === "search-console") {
      if (!config.searchConsoleSiteUrl) {
        return reply({ error: "Search Console non configurée pour ce site" }, 409);
      }

      return reply({
        provider,
        days,
        data: await searchConsole(config.searchConsoleSiteUrl, days),
      });
    }

    if (
      !config.clarityTokenEnv ||
      !/^CLARITY_TOKEN_[A-Z0-9_]+$/.test(config.clarityTokenEnv)
    ) {
      return reply({ error: "Clarity non configuré pour ce site" }, 409);
    }

    const token = process.env[config.clarityTokenEnv];

    if (!token) {
      return reply({ error: "Jeton Clarity manquant côté serveur" }, 409);
    }

    const { data: existing, error: readError } = await db
      .from("clarity_cache")
      .select("data,cached_at,next_attempt_at,lease_until")
      .eq("site_id", siteId)
      .maybeSingle();

    if (readError) throw new Error(`Lecture cache Clarity impossible: ${readError.message}`);
    const cached = (existing ?? null) as ClarityCacheRow | null;

    if (isFresh(cached)) return cacheReply(cached!, "fresh");

    if (isFuture(cached?.next_attempt_at) || isFuture(cached?.lease_until)) {
      if (cached?.data != null) return cacheReply(cached, "stale");
      return reply({ error: "Clarity est temporairement limité. Réessayez plus tard." }, 503);
    }

    const { data: claimed, error: claimError } = await db.rpc("claim_clarity_refresh", {
      p_site_id: siteId,
    });
    if (claimError) throw new Error(`Verrouillage cache Clarity impossible: ${claimError.message}`);

    if (!claimed) {
      // Another request may have refreshed the cache between the first read and the lease.
      const { data: latest, error: latestError } = await db
        .from("clarity_cache")
        .select("data,cached_at,next_attempt_at,lease_until")
        .eq("site_id", siteId)
        .maybeSingle();
      if (latestError) throw new Error(`Relecture cache Clarity impossible: ${latestError.message}`);
      const current = (latest ?? null) as ClarityCacheRow | null;
      if (current?.data != null) return cacheReply(current, isFresh(current) ? "fresh" : "stale");
      return reply({ error: "Actualisation Clarity en cours. Réessayez dans un instant." }, 503);
    }

    try {
      const freshData = await clarity(token);
      const cachedAt = new Date().toISOString();
      const { error: writeError } = await db
        .from("clarity_cache")
        .update({
          data: freshData,
          cached_at: cachedAt,
          next_attempt_at: cachedAt,
          lease_until: cachedAt,
          updated_at: cachedAt,
        })
        .eq("site_id", siteId);
      if (writeError) throw new Error(`Enregistrement cache Clarity impossible: ${writeError.message}`);
      return reply({ provider: "clarity", days: 3, data: freshData, cache: { state: "fresh", cachedAt } });
    } catch (cause) {
      const retryAt = new Date(Date.now() + CLARITY_RETRY_MS).toISOString();
      const { error: cooldownError } = await db
        .from("clarity_cache")
        .update({ next_attempt_at: retryAt, lease_until: new Date().toISOString(), updated_at: new Date().toISOString() })
        .eq("site_id", siteId);
      if (cooldownError) {
        console.error("[Syncore Integrations] Clarity cooldown", siteId, cooldownError.message);
      }
      console.error("[Syncore Integrations] clarity", siteId, cause instanceof Error ? cause.message : "Erreur");
      if (cached?.data != null) return cacheReply(cached, "stale");
      return reply({ error: "Microsoft Clarity est temporairement indisponible. Nouvelle tentative autorisée après le délai de protection." }, 503);
    }
  } catch (cause) {
    console.error(
      "[Syncore Integrations]",
      provider,
      siteId,
      cause instanceof Error ? cause.message : "Erreur"
    );

    return reply(
      {
        error: "Impossible de récupérer les données. Vérifiez la configuration et les autorisations du fournisseur.",
      },
      502
    );
  }
}
