import { requireAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import DeviceManager from "@/components/device-manager";
export const dynamic = "force-dynamic";
export default async function Devices() {
 const actor = await requireAccess(); if (actor.role !== "owner") redirect("/non-autorise");
 return <main className="wrap"><section className="panel"><h1>Appareils autorises</h1><DeviceManager /></section></main>;
}
