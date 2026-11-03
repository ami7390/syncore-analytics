import { redirect } from "next/navigation";
import { requireAccess } from "@/lib/access";
import { adminService } from "@/lib/admin-service";
import UserManager from "@/components/user-manager";
export const dynamic = "force-dynamic";
export default async function UsersPage() {
  const { role } = await requireAccess();
  if (role !== "owner") redirect("/non-autorise");
  const { data, error } = await adminService().from("admin_users")
    .select("user_id,role,active,created_at").order("created_at", { ascending: false });
  return <main className="wrap section"><div className="panel"><h1>Gestion des utilisateurs</h1>
    <p className="muted">Seul l'Admin principal peut créer des comptes ou modifier leurs accès.</p>
    {error ? <p className="error">Impossible de charger les comptes.</p> : <UserManager initialUsers={data ?? []}/>}
  </div></main>;
}
