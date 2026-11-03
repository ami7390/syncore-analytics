import Link from "next/link";
import { requireAccess } from "@/lib/access";
import SiteManager from "@/components/site-manager";
export const dynamic = "force-dynamic";
export default async function SitesPage() {
 const { role } = await requireAccess();
 return <main className="wrap section"><div className="panel" style={{ display: "grid", gap: 20 }}>
  <Link href="/admin" className="muted" style={{ fontSize: 14 }}>← Retour à l'administration</Link>
  <div><h1 style={{ marginBottom: 8 }}>Gestion des sites</h1><p className="muted" style={{ margin: 0 }}>{role === "owner" ? "Ajoutez des sites et attribuez-les aux administrateurs." : role === "director" ? "Consultez les sites supervisés par Syncore." : "Consultez et mettez à jour vos sites attribués."}</p></div>
  <SiteManager role={role} />
 </div></main>;
}
