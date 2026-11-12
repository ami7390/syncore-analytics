import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
import ThemeToggle from "@/components/theme-toggle";
export const metadata: Metadata = { title: "Syncore Analytics", description: "Analyse de performance web, SEO et accessibilité" };
const themeScript = `(function(){try{var t=localStorage.getItem('syncore-theme');if(t!=='dark'&&t!=='light')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return <html lang="fr" suppressHydrationWarning><head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head><body>
    <header className="top"><div className="wrap topin">
      <Link className="brand" href="/" aria-label="Syncore Analytics — Accueil"><span className="brand-symbol" aria-hidden="true">◈</span><span>Syncore <span className="brand-accent">Analytics</span></span></Link>
      <nav className="nav" aria-label="Navigation principale"><Link href="/">Analyse publique</Link><Link href="/admin">Tableau de bord</Link><Link href="/admin/sites">Projets</Link><Link href="/admin/integrations">Intégrations</Link></nav>
      <div className="top-actions"><ThemeToggle /><Link className="top-login" href="/login">Connexion</Link></div>
    </div></header>
    <div className="site-content">{children}</div>
    <footer className="footer"><div className="wrap footer-inner"><span>© Syncore Analytics</span><span>Supervision & performance des projets web</span></div></footer>
  </body></html>;
}
