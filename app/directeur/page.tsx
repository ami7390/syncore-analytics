
import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
import DirectorDashboard from "@/components/director-dashboard";
import MonthlyReports from "@/components/monthly-reports";

export const dynamic = "force-dynamic";

export default async function DirectorPage() {
  const access = await requireAccess();

  if (access.role !== "director" && access.role !== "owner") {
    redirect("/admin");
  }

  const db = adminService();
  const since = new Date();
  since.setUTCDate(since.getUTCDate() - 30);

  const [
    { data: sites, error: sitesError },
    { data: reports, error: reportsError },
  ] = await Promise.all([
    db
      .from("monitored_sites")
      .select("id,name,url,active")
      .order("name"),

    db
      .from("daily_reports")
      .select("site_id,report_date,content,generated_at")
      .gte("report_date", since.toISOString().slice(0, 10))
      .order("report_date", { ascending: true })
      .limit(2000),
  ]);

  if (sitesError || reportsError) {
    return (
      <main className="wrap section">
        <div className="panel">
          <h1>Espace Direction</h1>
          <p className="error">
            Impossible de charger les indicateurs pour le moment.
          </p>
        </div>
      </main>
    );
  }

  return (
    <>
      <DirectorDashboard email={access.user.email ?? "Directeur"} sites={sites ?? []} reports={reports ?? []} />
      <main className="wrap"><MonthlyReports owner={false} /></main>
    </>
  );
}
