import { cookies } from "next/headers";
import { createHash, randomBytes } from "node:crypto";
import { adminService } from "@/lib/admin-service";
export const devicesRequired = () => process.env.REQUIRE_DEVICE_APPROVAL === "true";
const scope = () => process.env.VERCEL_ENV === "production" ? "production" : "preview";
const name = "syncore_device_v1";
export async function deviceHash(create = false) {
  const jar = await cookies();
  let token = jar.get(name)?.value;
  if (!token || !/^[a-f0-9]{64}$/.test(token)) {
    if (!create) return null;
    token = randomBytes(32).toString("hex");
    jar.set(name, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: 60 * 60 * 24 * 90 });
  }
  return createHash("sha256").update(token).digest("hex");
}
export async function currentDevice(userId: string) {
  const hash = await deviceHash();
  if (!hash) return null;
  const { data, error } = await adminService().from("security_devices").select("id,status").eq("user_id", userId).eq("environment", scope()).eq("token_hash", hash).maybeSingle();
  if (error) throw error;
  return data;
}
export async function requestDevice(userId: string) {
  const hash = await deviceHash(true);
  const db = adminService();
  const { error } = await db.from("security_devices").upsert({ user_id: userId, environment: scope(), token_hash: hash }, { onConflict: "user_id,environment,token_hash", ignoreDuplicates: true });
  if (error) throw error;
  return currentDevice(userId);
}
export const deviceEnvironment = scope;
