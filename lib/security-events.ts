import { adminService } from "@/lib/admin-service";

export type SecurityEventType =
  | "mfa_verified"
  | "user_created"
  | "user_updated"
  | "device_decision";

// Server-side only. Never include passwords, MFA codes, secrets or tokens.
export async function recordSecurityEvent(event: {
  type: SecurityEventType;
  actorUserId: string;
  subjectUserId?: string;
  details?: Record<string, string | boolean>;
}) {
  try {
    const { error } = await adminService().from("security_events").insert({
      actor_user_id: event.actorUserId,
      event_type: event.type,
      subject_user_id: event.subjectUserId ?? null,
      details: event.details ?? {},
    });
    if (error) console.error("[Security events] Insert failed", error.code);
  } catch {
    console.error("[Security events] Unavailable");
  }
}
