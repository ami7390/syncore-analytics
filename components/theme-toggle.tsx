"use client";
import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
type Theme = "light" | "dark";
export default function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");
  useEffect(() => {
    const current = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
    setTheme(current);
  }, []);
  function changeTheme() {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    document.documentElement.style.colorScheme = next;
    localStorage.setItem("syncore-theme", next);
    setTheme(next);
  }
  return <button type="button" className="theme-toggle" onClick={changeTheme} aria-label={theme === "dark" ? "Activer le mode clair" : "Activer le mode sombre"} title={theme === "dark" ? "Mode clair" : "Mode sombre"}>
    {theme === "dark" ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
    <span>{theme === "dark" ? "Clair" : "Sombre"}</span>
  </button>;
}
