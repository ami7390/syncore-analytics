# Syncore Analytics - Surveillance Lighthouse multi-sites

## Installation
1. Les migrations Supabase `002_audit_jobs.sql`, `004_sites.sql` et `005_telegram_alerts.sql` doivent deja avoir ete executees. Aucune nouvelle migration n'est necessaire.
2. Copiez les quatre fichiers du correctif dans GitHub en respectant les chemins.
3. Conservez les secrets GitHub `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `TELEGRAM_BOT_TOKEN` et `TELEGRAM_CHAT_ID`.
4. Dans `/admin/sites`, enregistrez un site HTTPS et laissez-le actif.
5. GitHub Actions > Syncore Audit Worker > Run workflow. Dans les logs, cherchez `Daily sites:`, `Audit completed:` et `Bilan:`.
6. Verifiez Supabase : `select url,strategy,status,completed_at from public.audit_jobs order by created_at desc limit 20;`.

## Fonctionnement
- Le planificateur ajoute un audit mobile et desktop pour chaque site actif si aucun audit de meme URL et strategie n'a ete cree dans les 24 dernieres heures.
- Le worker traite trois jobs maximum par execution. Le workflow reste programme toutes les cinq minutes (planification non garantie a la minute pres par GitHub).
- Les alertes Telegram restent declenchees seulement si le score baisse d'au moins 15 points par rapport au precedent audit termine du meme site et du meme appareil.
- Le test Telegram manuel deja installe reste disponible.
- Les URL de sites inactifs ou absents de `monitored_sites` sont refusees par le worker. Le site de test historique `https://example.com/` reste autorise.
- Un proxy local limite les connexions HTTP(S) de Chromium aux destinations HTTPS sur port 443 dont la resolution DNS IPv4 est publique. Les ressources HTTP et certains sites complexes peuvent ne pas fonctionner correctement. Tester progressivement avec des sites que vous controlez.

## Limites et securite
- Ne transformez pas l'API publique `/api/analyze` en entree pour URL arbitraires. Elle reste volontairement limitee a example.com. Les audits multi-sites sont planifies par GitHub Actions depuis les sites enregistres par l'Admin principal.
- La verification DNS et le proxy sont une defense en profondeur, pas un isolement reseau garanti. Pour un deploiement a grande echelle avec des URL non fiables, isoler Chromium dans un conteneur avec filtrage reseau sortant et limiter l'acces aux metadonnees cloud.
- La planification actuelle ne reserve pas atomiquement les audits; une execution simultanee externe peut creer un doublon. Le groupe de concurrence GitHub Actions reduit ce risque pour le workflow fourni.
- Les sites avec beaucoup de pages ne sont pas explores : chaque audit concerne uniquement l'URL enregistree.
- Les erreurs de scan n'envoient pas encore d'alerte de disponibilite; seules les baisses de scores sont notifiees.
