import "./globals.css";
import type { Metadata } from "next";
import AppChrome from "@/components/app-chrome";

export const metadata: Metadata = {
  title: "Syncore Analytics",
  description: "Plateforme privée de supervision et de performance web",
  robots: { index: false, follow: false },
};
const themeScript = `(function(){try{var t=localStorage.getItem('syncore-theme');if(t!=='dark'&&t!=='light')t=window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){}})();`;
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: themeScript }} /></head>
      <body><AppChrome>{children}</AppChrome></body>
    </html>
  );
}
