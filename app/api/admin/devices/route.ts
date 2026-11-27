import { NextRequest, NextResponse } from "next/server";
import { getAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
import { currentDevice, deviceEnvironment, devicesRequired } from "@/lib/devices";
import { recordSecurityEvent } from "@/lib/security-events";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function GET() {
 const actor = await getAccess(); if (!devicesRequired() || actor?.role !== "owner") return reply({ error: "Acces refuse" }, 403);
 const { data, error } = await adminService().from("security_devices").select("id,user_id,status,created_at,decided_at").eq("environment", deviceEnvironment()).order("created_at", { ascending: false }).limit(200);
 return error ? reply({ error: "Lecture impossible" }, 503) : reply({ devices: data });
}
export async function POST(req: NextRequest) {
 if (req.headers.get("origin") !== req.nextUrl.origin) return reply({ error: "Origine refusee" }, 403);
 const actor = await getAccess(); if (!devicesRequired() || actor?.role !== "owner") return reply({ error: "Acces refuse" }, 403);
 let body; try { body = await req.json(); } catch { return reply({ error: "Requete invalide" }, 400); }
 const { id, status } = body ?? {};
 if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id) || !["approved", "denied", "revoked"].includes(status)) return reply({ error: "Decision invalide" }, 400);
 if ((await currentDevice(actor.user.id))?.id === id) return reply({ error: "Impossible de modifier votre navigateur courant" }, 409);
 const { data, error } = await adminService().from("security_devices").update({ status, decided_at: new Date().toISOString(), decided_by: actor.user.id }).eq("id", id).eq("environment", deviceEnvironment()).eq("status", status === "revoked" ? "approved" : "pending").select("id,user_id").maybeSingle();
 if (error || !data) return reply({ error: "Decision impossible" }, 409);
 await recordSecurityEvent({ type: "device_decision", actorUserId: actor.user.id, subjectUserId: data.user_id, details: { deviceId: id, status } });
 return reply({ ok: true });
}
