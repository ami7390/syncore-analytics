import Link from "next/link";
import { requireAccess } from "@/lib/access";
import { redirect } from "next/navigation";
import ProjectJournal from "@/components/project-journal";
export const dynamic = "force-dynamic";
export default async function JournalPage() {
  const access = await requireAccess();
  if (access.role !== "owner") redirect("/non-autorise");
  return <main className="wrap section"><div className="panel" style={{ display: "grid", gap: 20 }}>
    <Link href="/admin" className="muted" style={{ fontSize: 14 }}>← Retour à l'administration</Link>
    <div><h1 style={{ marginBottom: 8 }}>Journal des projets</h1><p className="muted" style={{ margin: 0 }}>Suivez les travaux réellement effectués et les améliorations à prévoir, par projet.</p></div>
    <ProjectJournal />
  </div></main>;
}
