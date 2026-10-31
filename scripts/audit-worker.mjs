
import { createClient } from "@supabase/supabase-js";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const exec = promisify(execFile);

// Maximum de tâches traitées par exécution GitHub Actions.
const MAX_JOBS_PER_RUN = 3;

// Mode test privé : domaines explicitement autorisés.
const ALLOWED_AUDIT_HOSTS = new Set([
  "example.com",
]);

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Configuration Supabase manquante.");
}

const db = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    persistSession: false,
  },
});

function publicIp(ip) {
  if (isIP(ip) !== 4) return false;

  const a = ip.split(".").map(Number);

  return !(
    a[0] === 0 ||
    a[0] === 10 ||
    a[0] === 127 ||
    a[0] >= 224 ||
    (a[0] === 169 && a[1] === 254) ||
    (a[0] === 172 && a[1] >= 16 && a[1] <= 31) ||
    (a[0] === 192 && a[1] === 168) ||
    (a[0] === 100 && a[1] >= 64 && a[1] <= 127) ||
    (a[0] === 192 && a[1] === 0) ||
    (a[0] === 198 && [18, 19].includes(a[1]))
  );
}

async function validate(raw) {
  let u;

  try {
    u = new URL(raw);
  } catch {
    throw new Error("URL invalide");
  }

  const hostname = u.hostname.toLowerCase().replace(/\.$/, "");

  if (
    u.protocol !== "https:" ||
    u.username ||
    u.password ||
    u.port ||
    isIP(hostname) ||
    !ALLOWED_AUDIT_HOSTS.has(hostname)
  ) {
    throw new Error("URL interdite");
  }

  const ips = await lookup(hostname, {
    all: true,
    family: 4,
  });

  if (
    !ips.length ||
    ips.some(({ address }) => !publicIp(address))
  ) {
    throw new Error("Adresse interdite");
  }

  return u;
}

async function processJob(job) {
  console.log("Starting audit:", job.id);

  // Réserver la tâche uniquement si elle est encore en attente.
  const { data: claimed, error: claimError } = await db
    .from("audit_jobs")
    .update({
      status: "running",
      started_at: new Date().toISOString(),
    })
    .eq("id", job.id)
    .eq("status", "pending")
    .select("id");

  if (claimError) {
    console.error("Unable to claim job:", job.id, claimError);
    return;
  }

  if (!claimed?.length) {
    console.log("Job already claimed:", job.id);
    return;
  }

  let dir;

  try {
    await validate(job.url);

    if (!["mobile", "desktop"].includes(job.strategy)) {
      throw new Error("Stratégie invalide");
    }

    dir = await mkdtemp(join(tmpdir(), "syncore-audit-"));
    const output = join(dir, "report");

    const args = [
      "lighthouse",
      job.url,
      "--output=json",
      "--output-path=" + output + ".report.json",
      "--chrome-flags=--headless --no-sandbox --disable-dev-shm-usage",
      "--quiet",
      "--only-categories=performance,accessibility,best-practices,seo",
      "--max-wait-for-load=45000",
    ];

    if (job.strategy === "desktop") {
      args.push("--preset=desktop");
    }

    // IMPORTANT :
    // Le filtrage réseau des connexions Chromium reste
    // nécessaire avant toute ouverture publique.
    await exec("npx", args, {
      timeout: 125000,
      maxBuffer: 1024 * 1024,
    });

    const lhr = JSON.parse(
      await readFile(output + ".report.json", "utf8")
    );

    if (!lhr.categories) {
      throw new Error("Rapport Lighthouse incomplet");
    }

    const scores = {};

    for (const c of [
      "performance",
      "accessibility",
      "best-practices",
      "seo",
    ]) {
      scores[c] =
        typeof lhr.categories?.[c]?.score === "number"
          ? Math.round(lhr.categories[c].score * 100)
          : null;
    }

    const metrics = {};

    for (const [key, label] of [
      ["first-contentful-paint", "FCP"],
      ["largest-contentful-paint", "LCP"],
      ["speed-index", "Speed Index"],
      ["total-blocking-time", "TBT"],
      ["cumulative-layout-shift", "CLS"],
    ]) {
      metrics[label] =
        lhr.audits?.[key]?.displayValue || "Non disponible";
    }

    const opportunities = Object.values(lhr.audits || {})
      .filter(
        (v) =>
          v?.details?.type === "opportunity" &&
          v?.score !== null &&
          v?.score < 0.9
      )
      .slice(0, 8)
      .map((v) => ({
        title: String(v.title),
        description: String(v.description || "")
          .replace(/<[^>]+>/g, "")
          .slice(0, 240),
      }));

    const result = {
      url: job.url,
      strategy: job.strategy,
      scores,
      metrics,
      opportunities,
      fetchedAt: new Date().toISOString(),
    };

    const { error: saveError } = await db
      .from("audit_jobs")
      .update({
        status: "completed",
        result,
        error: null,
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (saveError) {
      throw saveError;
    }

    console.log("Audit completed:", job.id);
  } catch (error) {
    console.error("Audit failed:", job.id, error);

    const { error: updateError } = await db
      .from("audit_jobs")
      .update({
        status: "failed",
        error: "Analyse impossible pour cette URL.",
        completed_at: new Date().toISOString(),
      })
      .eq("id", job.id);

    if (updateError) {
      console.error("Unable to save failure:", updateError);
    }
  } finally {
    if (dir) {
      await rm(dir, {
        recursive: true,
        force: true,
      });
    }
  }
}

async function main() {
  const { data: jobs, error } = await db
    .from("audit_jobs")
    .select("id,url,strategy")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(MAX_JOBS_PER_RUN);

  if (error) {
    throw error;
  }

  if (!jobs?.length) {
    console.log("No pending jobs");
    return;
  }

  console.log(`${jobs.length} audit(s) pending`);

  // Traitement séquentiel pour limiter la consommation
  // de mémoire et les ressources Chromium.
  for (const job of jobs) {
    await processJob(job);
  }

  console.log("Worker execution finished");
}

await main();
