# Syncore Analytics - Phase 2, lot A : journal de securite

## Contenu
- `security_events.sql` : table Supabase pour les evenements de securite (RLS active, aucun acces anon/authenticated).
- `lib/security-events.ts` : enregistrement cote serveur via service role.
- `app/api/auth/mfa/route.ts` : journalise la verification TOTP reussie.
- `app/api/admin/users/route.ts` : journalise les creations et modifications d'utilisateurs.

## Installation
1. Rester sur la branche `feat/enterprise-security` et conserver la Preview.
2. Copier uniquement les fichiers fournis aux chemins indiques.
3. Executer `security_events.sql` dans Supabase SQL Editor **avant** de deployer les fichiers TS.
4. Verifier que `SUPABASE_SERVICE_ROLE_KEY` est deja defini cote serveur dans Vercel Preview. Ne jamais utiliser `NEXT_PUBLIC_` pour cette cle.
5. Executer `npm install` (si necessaire), `npx tsc --noEmit`, puis `npm run build`.
6. Deployer sur Preview et tester une connexion MFA, puis la creation/modification d'un utilisateur de test.
7. Verifier les nouvelles lignes dans Supabase SQL Editor : `select event_type, actor_user_id, subject_user_id, created_at from public.security_events order by created_at desc limit 20;`.

## Limites importantes
- Ceci est un **premier lot**, pas encore un systeme d'approbation d'appareils.
- Les insertions dans le journal sont *best effort* : un incident de journalisation n'empeche pas les actions. Ne pas considerer le journal comme exhaustif.
- Aucune notification ni interface d'approbation n'est encore fournie.
- Ne pas fusionner en Production avant les tests d'acces directs aux pages et API, une strategie de recuperation MFA et les autres lots.
- Une empreinte navigateur seule n'est pas une preuve d'identite d'appareil. La phase suivante devra utiliser un jeton d'appareil aleatoire, signe/stocke de facon securisee, une expiration, une revocation et une approbation owner hors de l'appareil en attente.
