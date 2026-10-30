import { NextRequest, NextResponse } from "next/server";
import { fetchPageSpeed, type AuditResult, type Strategy } from "@/lib/pagespeed";

export const runtime = "nodejs";

// Cache temporaire par instance. Sur Vercel, il n'est pas partage entre instances.
const CACHE_TTL_MS = 6 * 60 * 60 * 1000;
const MAX_CACHE_ITEMS = 200;
const cache = new Map<string, { result: AuditResult; expires: number }>();
const hits = new Map<string, { count: number; until: number }>();

function forbidden(host: string): boolean {
  const h = host.toLowerCase().replace(/\.$/, "");
  if (["localhost", "metadata.google.internal"].includes(h) || /\.(localhost|local|internal|test|invalid|example|onion|arpa)$/.test(h)) return true;
  if (h.includes(":") || /^\d+$/.test(h)) return true;
  if (/^\d+\.\d+\.\d+\.\d+$/.test(h)) {
    const p = h.split(".").map(Number);
    return p.some(n => n > 255) || p[0] === 0 || p[0] === 10 || p[0] === 127 || p[0] >= 224 ||
      (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) ||
      (p[0] === 192 && p[1] === 168) || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) ||
      (p[0] === 192 && p[1] === 0) || (p[0] === 198 && [18, 19].includes(p[1]));
  }
  return false;
}

function cleanExpired(now: number) {
  for (const [key, item] of cache) if (item.expires <= now) cache.delete(key);
  for (const [key, item] of hits) if (item.until <= now) hits.delete(key);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    if (typeof body?.url !== "string" || body.url.length > 2048) {
      return NextResponse.json({ error: "URL invalide." }, { status: 400 });
    }
    let url: URL;
    try { url = new URL(body.url); }
    catch { return NextResponse.json({ error: "Entrez une URL complète commençant par https://" }, { status: 400 }); }
    if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.port ||
        forbidden(url.hostname) || !url.hostname.includes(".")) {
      return NextResponse.json({ error: "Seules les URL publiques HTTP/HTTPS sont autorisées." }, { status: 400 });
    }

    url.hash = "";
    const strategy: Strategy = body.strategy === "desktop" ? "desktop" : "mobile";
    const key = `${strategy}:${url.toString()}`;
    const now = Date.now();
    cleanExpired(now);
    const existing = cache.get(key);
    if (existing) return NextResponse.json({ ...existing.result, cached: true });

    // Limitation basique par instance; elle ne garantit pas un quota global sur Vercel.
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    const entry = hits.get(ip);
    if (entry && entry.until > now && entry.count >= 5) {
      return NextResponse.json({ error: "Limite de 5 nouvelles analyses par heure atteinte. Réessayez plus tard." }, { status: 429 });
    }
    hits.set(ip, entry && entry.until > now ? { count: entry.count + 1, until: entry.until } : { count: 1, until: now + 3600000 });

    try {
      const result = await fetchPageSpeed(url.toString(), strategy);
      if (cache.size >= MAX_CACHE_ITEMS) cache.delete(cache.keys().next().value!);
      cache.set(key, { result, expires: now + CACHE_TTL_MS });
      return NextResponse.json({ ...result, cached: false });
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      if (/quota exceeded|queries per day|rate limit|resource_exhausted|daily limit/i.test(message)) {
        return NextResponse.json({ error: "Le quota gratuit de Google PageSpeed est épuisé. Réessayez plus tard : une nouvelle analyse ne peut pas être lancée pour le moment.", code: "PAGESPEED_QUOTA" }, { status: 503 });
      }
      return NextResponse.json({ error: "L'analyse PageSpeed est momentanément indisponible. Réessayez plus tard.", code: "PAGESPEED_UNAVAILABLE" }, { status: 502 });
    }
  } catch {
    return NextResponse.json({ error: "Impossible de traiter la demande." }, { status: 400 });
  }
}
