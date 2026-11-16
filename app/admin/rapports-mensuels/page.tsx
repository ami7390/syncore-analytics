import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import MonthlyReports from "@/components/monthly-reports";
export const dynamic = "force-dynamic";
export default async function MonthlyReportsAdminPage() {
  const access = await requireAccess();
  if (access.role !== "owner") redirect("/admin");
  return <main className="wrap section"><h1>Rapports mensuels</h1><MonthlyReports owner /></main>;
}
