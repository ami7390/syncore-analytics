import { createSign } from "node:crypto";

export type SiteConfig = { ga4PropertyId?: string; searchConsoleSiteUrl?: string; clarityProjectId?: string; clarityTokenEnv?: string };
export function siteConfig(siteId: string): SiteConfig {
  const raw = process.env.SYNCORE_SITE_INTEGRATIONS;
  if (!raw) return {};
  let data: unknown;
  try { data = JSON.parse(raw); } catch { throw new Error("SYNCORE_SITE_INTEGRATIONS contient un JSON invalide"); }
  if (!data || typeof data !== "object" || Array.isArray(data)) throw new Error("Configuration des intégrations invalide");
  const record = data as Record<string, unknown>;
 const entry = record[siteId];

const config: SiteConfig =
  entry && typeof entry === "object" && !Array.isArray(entry)
    ? { ...(entry as SiteConfig) }
    : {};

if (siteId === "b0e57be8-075a-413e-8c8e-27e6f15e1040") {
  const propertyUrl = process.env.SYNCORE_REINA_GSC_PROPERTY_URL;

  if (propertyUrl) {
    config.searchConsoleSiteUrl = propertyUrl;
  }
}

return config;
}
function base64url(value: string | Buffer) { return Buffer.from(value).toString("base64url"); }
async function googleToken(scopes: string[]) {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !key) throw new Error("Compte de service Google non configuré");
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64url(JSON.stringify({ iss: email, scope: scopes.join(" "), aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3500 }));
  const input = `${header}.${payload}`;
  const signer = createSign("RSA-SHA256"); signer.update(input); signer.end();
  const assertion = `${input}.${signer.sign(key).toString("base64url")}`;
  const response = await fetch("https://oauth2.googleapis.com/token", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }), signal: AbortSignal.timeout(12000), cache: "no-store" });
 if (!response.ok) {
  const errorBody: unknown = await response.json().catch(() => null);

  const googleError =
    errorBody && typeof errorBody === "object"
      ? errorBody as { error?: unknown; error_description?: unknown }
      : {};

  const errorCode =
    typeof googleError.error === "string"
      ? googleError.error
      : "unknown";

  const errorDescription =
    typeof googleError.error_description === "string"
      ? googleError.error_description
      : "Aucune description fournie";

  throw new Error(
    `Authentification Google refusée (${response.status}) : ${errorCode} - ${errorDescription}`
  );
}
  const json: unknown = await response.json();
  const token = (json as { access_token?: unknown }).access_token;
  if (typeof token !== "string") throw new Error("Jeton Google manquant");
  return token;
}
async function googleJson(url: string, token: string, body: object) {
  const response = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${token}`, "content-type": "application/json" }, body: JSON.stringify(body), signal: AbortSignal.timeout(18000), cache: "no-store" });
  if (!response.ok) throw new Error(`Accès Google refusé (${response.status}). Vérifiez les autorisations du compte de service.`);
  return response.json();
}
export async function ga4(propertyId: string, days: number) {
  if (!/^\d{4,20}$/.test(propertyId)) throw new Error("Identifiant de propriété GA4 invalide");
  const token = await googleToken(["https://www.googleapis.com/auth/analytics.readonly"]);
  const dateRanges = [{ startDate: `${days - 1}daysAgo`, endDate: "today" }];
  const base = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const [totals, daily] = await Promise.all([
    googleJson(base, token, { dateRanges, metrics: [{ name: "activeUsers" }, { name: "sessions" }, { name: "screenPageViews" }, { name: "conversions" }] }),
    googleJson(base, token, { dateRanges, dimensions: [{ name: "date" }], metrics: [{ name: "activeUsers" }, { name: "sessions" }], orderBys: [{ dimension: { dimensionName: "date" } }], limit: 100 }),
  ]);
  return { totals: (totals as { rows?: unknown[] }).rows ?? [], daily: (daily as { rows?: unknown[] }).rows ?? [] };
}
export async function searchConsole(siteUrl: string, days: number) {
  if (!siteUrl.startsWith("https://") && !siteUrl.startsWith("sc-domain:")) throw new Error("Propriété Search Console invalide");
  const token = await googleToken(["https://www.googleapis.com/auth/webmasters.readonly"]);
  const end = new Date(Date.now() - 3 * 86400000);
  const start = new Date(end.getTime() - (days - 1) * 86400000);
  const fmt = (date: Date) => date.toISOString().slice(0, 10);
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(siteUrl)}/searchAnalytics/query`;
  const [daily, queries] = await Promise.all([
    googleJson(url, token, { startDate: fmt(start), endDate: fmt(end), dimensions: ["date"], rowLimit: 100 }),
    googleJson(url, token, { startDate: fmt(start), endDate: fmt(end), dimensions: ["query"], rowLimit: 10 }),
  ]);
  return { daily: (daily as { rows?: unknown[] }).rows ?? [], queries: (queries as { rows?: unknown[] }).rows ?? [] };
}
export async function clarity(token: string) {
  const url =
    "https://www.clarity.ms/export-data/api/v1/project-live-insights?numOfDays=3";

  const response = await fetch(url, {
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
    },
    signal: AbortSignal.timeout(18000),
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Clarity a refusé la requête (${response.status})`);
  }

  return response.json();
}

