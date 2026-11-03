# Syncore Analytics - Alertes Telegram (etape 3)

## 1. Creer un bot

Dans Telegram, ouvrez le compte officiel @BotFather, envoyez /newbot et suivez les instructions. Conservez le token secret : ne le partagez pas et ne l'ajoutez jamais au depot GitHub.

## 2. Obtenir le Chat ID

Ouvrez une conversation privee avec votre nouveau bot et envoyez /start. Dans votre navigateur, consultez :

https://api.telegram.org/bot<VOTRE_TOKEN>/getUpdates

Reperez `message.chat.id` dans la reponse JSON. Ne partagez pas cette URL, elle contient votre token. Si `result` est vide, envoyez un nouveau message au bot puis actualisez. Pour un groupe, ajoutez le bot au groupe et envoyez-y un message; l'ID peut etre negatif.

## 3. Configurer GitHub Actions

Dans GitHub > Settings > Secrets and variables > Actions > New repository secret, ajoutez :

- `TELEGRAM_BOT_TOKEN` : token remis par BotFather
- `TELEGRAM_CHAT_ID` : identifiant du chat

Les secrets `SUPABASE_URL` et `SUPABASE_SERVICE_ROLE_KEY` doivent deja exister pour le worker. Ces secrets Telegram vont dans GitHub Actions (pas dans NEXT_PUBLIC_* ni dans le code client). Le seuil par defaut est 15 points; modifiez `PERFORMANCE_ALERT_DROP_POINTS` dans le workflow si besoin.

## 4. Migration SQL

Executez `supabase/migrations/005_telegram_alerts.sql` dans Supabase SQL Editor.

## 5. Installer les fichiers

Copiez les fichiers de l'archive a leurs chemins exacts, commitez, puis executez le workflow `Syncore Audit Worker` depuis GitHub Actions > Run workflow pour verifier qu'il demarre.

## 6. Verifier les alertes

Une alerte est creee uniquement si une analyse Lighthouse *reussie* du meme URL et de la meme strategie (mobile/desktop) perd au moins 15 points par rapport a la precedente. Il faut donc au moins deux analyses comparables. Consultez `public.performance_alerts` dans Supabase et les logs du workflow GitHub Actions.

Les erreurs Telegram laissent les alertes en `needs_review` (sans renvoi automatique pour eviter les doublons). Si un workflow s'interrompt au milieu d'un envoi, la ligne peut rester en `sending`; verifiez manuellement la livraison avant toute relance. Les alertes ne sont pas des controles de disponibilite. La frequence effective depend des audits produits par le moteur existant.

## Limitation existante a connaitre

Le worker et l'API d'analyse fournis dans le projet n'acceptent encore que `example.com` : ce correctif Telegram ne retire pas cette protection SSRF et ne planifie pas de nouveaux audits sur les sites enregistres. La surveillance de tous les domaines necessite une prochaine modification securisee de la validation et de la programmation des audits.
