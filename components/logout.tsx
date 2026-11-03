"use client";
import { useRouter } from "next/navigation";
export default function Logout() {
  const router = useRouter();
  return <button className="btn secondary" onClick={async () => {
    const response = await fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" });
    if (response.ok) { router.replace("/login"); router.refresh(); }
  }}>Se déconnecter</button>;
}
