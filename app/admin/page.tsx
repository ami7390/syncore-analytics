
import { redirect } from "next/navigation";
import Link from "next/link";
import { requireAccess } from "@/lib/access";
import Logout from "@/components/logout";
import {
  Activity,
  FolderKanban,
  Users,
  NotebookPen,
  CalendarDays,
  ArrowUpRight,
  LayoutDashboard,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const { user, role } = await requireAccess();

  if (role === "director") redirect("/directeur");

  const isOwner = role === "owner";
  const title = isOwner
    ? "Administration principale"
    : "Administration des sites";
  const roleLabel = isOwner ? "Admin principal" : "Administrateur";

  const cards = [
    ...(isOwner && process.env.REQUIRE_DEVICE_APPROVAL === "true" ? [{ href: "/admin/appareils", title: "Appareils autorisés", description: "Approuver ou révoquer les navigateurs.", icon: Users, action: "Gérer les appareils" }] : []),
    ...(isOwner
      ? [
          {
            href: "/admin/utilisateurs",
            title: "Gestion des utilisateurs",
            description:
              "Gérer les comptes, les rôles et les autorisations de la plateforme.",
            icon: Users,
            action: "Gérer les utilisateurs",
          },
          {
            href: "/admin/journal",
            title: "Journal des projets",
            description:
              "Suivre les interventions, corrections et améliorations réellement effectuées.",
            icon: NotebookPen,
            action: "Ouvrir le journal",
          },
        ]
      : []),
    ...(isOwner
      ? [
          {
            href: "/admin/rapports-quotidiens",
            title: "Rapports quotidiens",
            description:
              "Consulter les bilans automatiques et les améliorations prioritaires par projet.",
            icon: CalendarDays,
            action: "Voir les rapports",
          },
        ]
      : []),
    ...(isOwner
      ? [
          {
            href: "/directeur",
            title: "Espace Directeur",
            description:
              "Consulter le tableau de bord stratégique, les indicateurs de performance et les graphiques des projets supervisés.",
            icon: LayoutDashboard,
            action: "Accéder à l'espace Directeur",
          },
        ]
      : []),
    ...(isOwner
      ? [
          {
            href: "/admin/rapports-mensuels",
            title: "Rapports mensuels PDF",
            description:
              "Préparer, consulter et publier les bilans mensuels pour la Direction.",
            icon: CalendarDays,
            action: "Gérer les rapports mensuels",
          },
        ]
      : []),
    {
      href: "/admin/sites",
      title: "Sites supervisés",
      description: isOwner
        ? "Ajouter des projets et attribuer les sites aux administrateurs."
        : "Consulter les projets qui vous sont attribués.",
      icon: FolderKanban,
      action: "Gérer les sites",
    },
    {
      href: "/admin/integrations",
      title: "Analyses et intégrations",
      description:
        "Suivre les données Google Analytics 4, Search Console et Microsoft Clarity.",
      icon: Activity,
      action: "Voir les analyses",
    },
  ];

  return (
    <main className="wrap section admin-landing">
      <header className="admin-head">
        <div>
          <p className="admin-eyebrow">
            Espace sécurisé · Syncore Analytics
          </p>
          <h1>{title}</h1>
          <p className="muted" style={{ margin: 0 }}>
            Bienvenue {user.email}. Pilotez vos projets depuis un espace unifié.
          </p>
        </div>
        <span className="chip">{roleLabel}</span>
      </header>

      <section className="admin-cards" aria-label="Modules disponibles">
        {cards.map(({ href, title, description, icon: Icon, action }) => (
          <article className="admin-card" key={href}>
            <span className="admin-card-icon">
              <Icon size={22} aria-hidden="true" />
            </span>
            <h2>{title}</h2>
            <p>{description}</p>
            <Link
              className="btn"
              href={href}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
              }}
            >
              {action}
              <ArrowUpRight size={16} aria-hidden="true" />
            </Link>
          </article>
        ))}
      </section>

      <div className="admin-signout">
        <Logout />
      </div>
    </main>
  );
}
