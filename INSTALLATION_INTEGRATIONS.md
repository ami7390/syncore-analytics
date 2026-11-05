# Syncore Analytics — Intégrations GA4, Search Console et Clarity

## Mise en place

1. Copier les fichiers du ZIP dans le dépôt et déployer sur Vercel.
2. Dans Supabase, relever les UUID des sites de `monitored_sites` (colonne `id`).
3. Créer un **compte de service Google** dans Google Cloud et activer les API **Google Analytics Data API** et **Google Search Console API**.
4. Donner à l'adresse du compte de service un accès **Lecteur/Viewer** dans chaque propriété GA4 et un accès approprié aux propriétés Search Console. L'adresse du compte de service doit être ajoutée explicitement aux propriétés ; les API activées ne suffisent pas.
5. Définir les variables Vercel `GOOGLE_SERVICE_ACCOUNT_EMAIL` et `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` (clé PEM privée ; ne jamais la committer).
6. Créer un jeton d'export Clarity pour chaque projet concerné. Définir une variable Vercel par jeton, par exemple `CLARITY_TOKEN_SITE_A`. Les données Clarity disponibles dépendent des limites de l'API officielle.
7. Définir dans Vercel `SYNCORE_SITE_INTEGRATIONS` comme **chaîne JSON**. Exemple (remplacer les UUID et les identifiants) :

```json
{
  "00000000-0000-4000-8000-000000000001": {
    "ga4PropertyId": "123456789",
    "searchConsoleSiteUrl": "sc-domain:exemple.fr",
    "clarityTokenEnv": "CLARITY_TOKEN_SITE_A"
  }
}
```

`searchConsoleSiteUrl` peut aussi être l'URL exacte d'une propriété préfixe, par exemple `https://www.exemple.fr/`. Ne pas confondre identifiant GA4 (numérique) et identifiant de mesure G-XXXX.

8. Redéployer Vercel après modification des variables et ouvrir `/admin/integrations`.

## Sécurité et limites

- Aucun secret n'est exposé dans le navigateur : l'API vérifie la session et les attributions de sites avant tout appel externe.
- `owner` et `director` peuvent consulter tous les sites ; `admin` uniquement les sites attribués. La page ne permet pas de modifier les accès.
- La méthode utilise un **compte de service Google** (accès accordé manuellement), et **non Google OAuth** : elle est adaptée aux propriétés que l'organisation contrôle. Une connexion OAuth par utilisateur nécessite un développement complémentaire.
- Les appels sont effectués à la demande, sans stockage historique ni tâche de synchronisation. Les données GA4 peuvent être retardées ; Search Console utilise une fenêtre terminée trois jours avant la date courante.
- L'API Clarity renvoie ses agrégats bruts : l'interface affiche le JSON pour l'instant. Les heatmaps et enregistrements ne sont pas intégrés à cette étape.
- Aucune migration SQL nécessaire. Les analyses Lighthouse, le worker, le proxy et Telegram restent inchangés.
