# Syncore Audit API — prototype GitHub Actions

## Avertissement avant mise en production publique
Ce prototype NE doit PAS être activé pour des URL arbitraires soumises par le public avant d'ajouter un filtrage réseau sortant robuste (DNS rebinding, redirections, requêtes secondaires du navigateur, accès aux métadonnées cloud), une authentification/limitation distribuée et une gestion de file atomique. Les validations DNS incluses sont seulement une première barrière. Préférer d'abord une liste de domaines vérifiés. Le worker GitHub Actions consomme des minutes de votre forfait et les exécutions planifiées peuvent être retardées ou suspendues.

## Installation
1. Exécuter `supabase/migrations/002_audit_jobs.sql` dans SQL Editor du projet Supabase **Syncore Analytics**.
2. Sur Vercel, ajouter `SUPABASE_SERVICE_ROLE_KEY` (clé serveur, jamais `NEXT_PUBLIC_`) et `AUDIT_HASH_SECRET` (chaîne aléatoire >= 24 caractères). Conserver les variables Supabase existantes.
3. Dans GitHub > dépôt syncore-analytics > Settings > Secrets and variables > Actions, ajouter `SUPABASE_URL` (URL Supabase) et `SUPABASE_SERVICE_ROLE_KEY` (clé serveur). Ne jamais afficher ces valeurs dans les logs.
4. Copier les fichiers du correctif aux chemins indiqués puis pousser sur `main`.
5. Dans GitHub > Actions, exécuter manuellement « Syncore Audit Worker » pour tester une demande; ensuite le planificateur GitHub lancera au mieux toutes les 5 minutes (non garanti).
6. Test API `POST /api/audit` JSON `{ "url":"https://example.com", "strategy":"mobile" }`; noter `id`, puis `GET /api/audit/{id}` pour suivre `pending/running/completed/failed`.

## Limitations actuelles
- L'interface publique existante continue d'utiliser `/api/analyze` et Google PageSpeed : aucun changement visuel ni bascule automatique n'a été effectué.
- Les statuts sont consultables via l'API, mais le suivi graphique et la connexion à la page d'accueil sont une phase ultérieure.
- Le worker traite une demande par exécution et peut prendre plusieurs minutes.
- Les rapports sont des résultats Lighthouse de laboratoire, sans données terrain CrUX.
- La confidentialité des résultats dépend de la connaissance de l'UUID; ne pas soumettre de sites confidentiels dans ce prototype.
- Ajouter une politique de rétention/purge des jobs et une politique anti-abus avant ouverture publique.
