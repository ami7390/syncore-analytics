"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import ThemeToggle from "@/components/theme-toggle";

export default function AppChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  if (pathname === "/login" || pathname === "/non-autorise") {
    return <div className="private-auth-page">{children}</div>;
  }
  return (
    <>
      <header className="top"><div className="wrap topin">
        <Link className="brand" href="/" aria-label="Syncore Analytics — Accueil">
          <span className="brand-symbol" aria-hidden="true">◈</span>
          <span>Syncore <span className="brand-accent">Analytics</span></span>
        </Link>
        <nav className="nav" aria-label="Navigation principale">
          <Link href="/admin">Tableau de bord</Link>
          <Link href="/admin/sites">Projets</Link>
          <Link href="/admin/integrations">Intégrations</Link>
        </nav>
        <div className="top-actions"><ThemeToggle /></div>
      </div></header>
      <div className="site-content">{children}</div>
     <footer className="footer">
  <div className="wrap footer-inner">
    <span>© Syncore Analytics</span>
    <span>Supervision & performance des projets web</span>
  </div>
</footer>
    </>
  );
}
