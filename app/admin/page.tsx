import Link from "next/link";
import { requireAccess } from "@/lib/access";
import Logout from "@/components/logout";
export const dynamic = "force-dynamic";
export default async function Admin() {
  const { user, role } = await requireAccess();
  const title = role === "owner" ? "Administration principale" : role === "director" ? "Espace Direction" : "Administration des sites";
  return <main className="wrap section"><div className="panel">
    <h1>{title}</h1><p className="muted">Bienvenue {user.email}. Votre rôle : {role === "owner" ? "Admin principal" : role === "admin" ? "Administrateur" : "Directeur"}.</p>
    {role === "owner" && <p><Link className="btn" href="/admin/utilisateurs">Gérer les utilisateurs</Link></p>}
    <div className="notice">Les modules de sites attribués, de rapports et de collecte GA4, Search Console et Clarity seront intégrés dans les prochaines étapes. Aucun accès aux données d'un autre site n'est accordé par cette page.</div>
    <div style={{marginTop:20}}><Logout/></div>
  </div></main>;
}
