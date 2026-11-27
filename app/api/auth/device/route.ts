import { NextRequest, NextResponse } from "next/server";
import { getIdentity } from "@/lib/access";
import { currentDevice, requestDevice, devicesRequired } from "@/lib/devices";
const reply = (body: object, status = 200) => NextResponse.json(body, { status, headers: { "Cache-Control": "no-store" } });
export async function POST(req: NextRequest) {
  if (req.headers.get("origin") !== req.nextUrl.origin) return reply({ error: "Origine refusee" }, 403);
  const actor = await getIdentity();
  if (!actor) return reply({ error: "MFA requis" }, 401);
  try {
    const device = devicesRequired() ? await requestDevice(actor.user.id) : null;
    return reply({ device, role: actor.role, required: devicesRequired() });
  } catch { return reply({ error: "Controle indisponible" }, 503); }
}
export async function GET() {
  const actor = await getIdentity();
  if (!actor) return reply({ error: "MFA requis" }, 401);
  try { return reply({ device: await currentDevice(actor.user.id), role: actor.role, required: devicesRequired() }); }
  catch { return reply({ error: "Controle indisponible" }, 503); }
}
