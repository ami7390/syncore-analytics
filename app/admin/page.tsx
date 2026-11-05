
import Link from "next/link";
import { requireAccess } from "@/lib/access";
import Logout from "@/components/logout";

export const dynamic = "force-dynamic";

export default async function Admin() {
  const { user, role } = await requireAccess();

  const isOwner = role === "owner";

  const title =
    role === "owner"
      ? "Administration principale"
      : role === "director"
        ? "Espace Direction"
        : "Administration des sites";

  const roleLabel =
    role === "owner"
      ? "Admin principal"
      : role === "admin"
        ? "Administrateur"
        : "Directeur";

  return (
    <main className="wrap section">
      <div
        className="panel"
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 24,
        }}
      >
        {/* En-tête */}
        <header
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <div style={{minWidth: 0}}>
            <h1 style={{ margin: "0 0 12px" }}>
              {title}
            </h1>

            <p
              className="muted"
              style={{
                margin: 0,
                lineHeight: 1.7,
                overflowWrap: "anywhere",
              }}
            >
              Bienvenue {user.email}.
              <br />
              Gérez votre espace Syncore Analytics.
            </p>
          </div>

          <span
            className="chip"
            style={{
              display: "inline-flex",
              alignItems: "center",
              margin: 0,
              fontWeight: 700,
            }}
          >
            {roleLabel}
          </span>
        </header>

        <div
          style={{
            height: 1,
            background: "var(--line)",
          }}
        />

        {/* Gestion réservée à l'Admin principal */}
        {isOwner && (
          <section>
            <h2
              style={{
                fontSize: 13,
                letterSpacing: 1,
                color: "var(--muted)",
                margin: "0 0 16px",
                textTransform: "uppercase",
              }}
            >
              Gestion de la plateforme
            </h2>

            <div
              style={{
                border: "1px solid var(--line)",
                borderRadius: 14,
                padding: 20,
                background: "var(--card)",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 16,
                  marginBottom: 20,
                }}
              >
                <div
                  aria-hidden="true"
                  style={{
                    width: 48,
                    height: 48,
                    borderRadius: 12,
                    background: "#e6f1e9",
                    color: "var(--green)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <svg
                    width="25"
                    height="25"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.8"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                    <circle cx="9" cy="7" r="4" />
                    <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
                    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                  </svg>
                </div>

                <div>
                  <h3
                    style={{
                      fontSize: 18,
                      margin: "0 0 6px",
                    }}
                  >
                    Gestion des utilisateurs
                  </h3>

                  <p
                    className="muted"
                    style={{
                      margin: 0,
                      fontSize: 14,
                      lineHeight: 1.6,
                    }}
                  >
                    Créer des administrateurs, gérer les
                    rôles et contrôler les accès.
                  </p>
                </div>
              </div>

              <Link
                href="/admin/utilisateurs"
                className="btn"
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: 10,
                  width: "100%",
                  textAlign: "center",
                }}
              >
                Gérer les utilisateurs
                <span aria-hidden="true">→</span>
              </Link>
            </div>
          </section>
        )}

        {/* Sites supervisés : droits appliqués par les API */}
        <section style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 20, background: "var(--card)" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>Gestion des sites</h2>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 14 }}>
            {isOwner ? "Ajoutez les sites Syncore et attribuez-les aux administrateurs." : role === "director" ? "Consultez tous les sites supervisés." : "Consultez les sites qui vous sont attribués."}
          </p>
          <Link href="/admin/sites" className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>
            {role === "director" ? "Consulter les sites" : "Gérer les sites"} →
          </Link>
        </section>

        <section style={{ border: "1px solid var(--line)", borderRadius: 14, padding: 20, background: "var(--card)" }}>
          <h2 style={{ margin: "0 0 8px", fontSize: 18 }}>GA4 · Search Console · Clarity</h2>
          <p className="muted" style={{ margin: "0 0 16px", fontSize: 14 }}>Consultez les statistiques des sites supervisés et leurs sources de trafic.</p>
          <Link href="/admin/integrations" className="btn" style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%" }}>Ouvrir les intégrations →</Link>
        </section>

        {/* Modules à venir */}
        <section
          style={{
            background: "#f3f6f1",
            border: "1px solid var(--line)",
            borderRadius: 14,
            padding: 20,
          }}
        >
          <h2
            style={{
              fontSize: 17,
              margin: "0 0 10px",
            }}
          >
            Prochains modules
          </h2>

          <p
            className="muted"
            style={{
              fontSize: 14,
              lineHeight: 1.8,
              margin: 0,
            }}
          >
            La gestion des sites attribués, les rapports
            manuels et la collecte des indicateurs Google
            Analytics 4, Google Search Console et Microsoft
            Clarity seront intégrés progressivement.
          </p>

          <p
            className="muted"
            style={{
              fontSize: 13,
              lineHeight: 1.7,
              margin: "12px 0 0",
            }}
          >
            Les autorisations de consultation et de
            modification restent définies selon le rôle
            de chaque utilisateur.
          </p>
        </section>

        {/* Déconnexion */}
        <footer
          style={{
            borderTop: "1px solid var(--line)",
            paddingTop: 20,
            display: "flex",
            justifyContent: "flex-end",
          }}
        >
          <Logout />
        </footer>
      </div>
    </main>
  );
}
