import { requireAccess } from "@/lib/access";
import IntegrationsDashboard from "@/components/integrations-dashboard";
export const dynamic = "force-dynamic";
export default async function IntegrationsPage() {
  await requireAccess();
  return <main className="wrap section"><div className="panel"><h1>Analyses et intégrations</h1><p className="muted">Google Analytics 4, Search Console et Microsoft Clarity par site supervisé.</p><IntegrationsDashboard /></div></main>;
}
