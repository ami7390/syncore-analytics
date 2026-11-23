import Link from "next/link";
export default function Unauthorized() {
  return <main className="private-auth-card">
    <h1>Accès non autorisé</h1>
    <p className="private-auth-subtitle">Ce compte ne dispose pas des autorisations nécessaires. Contactez votre administrateur.</p>
    <Link className="btn private-auth-submit" href="/login">Retour à la connexion</Link>
  </main>;
}
