import "./globals.css";
import type { Metadata } from "next";
import Link from "next/link";
export const metadata: Metadata = { title: "Syncore Analytics", description: "Analyse de performance web, SEO et accessibilite" };
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="fr"><body><header className="top"><div className="wrap topin"><Link className="brand" href="/">◈ Syncore Analytics</Link><nav className="nav"><Link href="/">Analyse publique</Link><Link href="/login">Administration</Link></nav></div></header>{children}<footer className="footer">© Syncore Analytics · Analyses techniques avec Google PageSpeed Insights</footer></body></html>}
