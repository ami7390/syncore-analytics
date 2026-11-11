import Link from "next/link";
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import DailyReports from "@/components/daily-reports";
export const dynamic = "force-dynamic";
export default async function DailyReportsPage() {
 const access = await requireAccess();
 if (access.role !== "owner") redirect("/non-autorise");
 return <main className="wrap section"><div className="panel" style={{ display: "grid", gap: 20 }}><Link href="/admin" className="muted">← Retour à l'administration</Link><div><h1>Rapports quotidiens</h1><p className="muted">Bilans techniques automatiques, privés et réservés à l'Administrateur principal.</p></div><DailyReports /></div></main>;
}
