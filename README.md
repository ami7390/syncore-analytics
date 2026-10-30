# Syncore Analytics — V1

Application **indépendante de Syncore Monitor**. PageSpeed Insights public, administration privée Supabase.

## 1. Installer sur Windows (PowerShell)

```powershell
cd C:\Next.js
# Extraire l'archive ici, dans un dossier syncore-analytics
cd syncore-analytics
npm install
Copy-Item .env.example .env.local
```

Modifier `.env.local` avec l'URL et la clé Publishable du **nouveau** projet Supabase.

```powershell
npm run dev
```

Ouvrir http://localhost:3000.

## 2. Préparer Supabase

1. Dans **SQL Editor**, exécuter `supabase/migrations/001_admin_users.sql`.
2. Dans **Authentication > Providers > Email**, désactiver les inscriptions publiques (Sign ups), si souhaité.
3. Dans **Authentication > Users**, créer manuellement votre compte admin.
4. Dans SQL Editor, exécuter en remplaçant l'adresse :

```sql
insert into public.admin_users(user_id)
select id from auth.users where email = 'votre-email@exemple.com'
on conflict do nothing;
```

Seuls les utilisateurs présents dans `admin_users` accèdent à `/admin`.

## 3. GitHub

Dans le dossier `syncore-analytics` :

```powershell
git init
git branch -M main
git add .
git commit -m "Initial Syncore Analytics V1"
git remote add origin https://github.com/VOTRE-COMPTE/syncore-analytics.git
git push -u origin main
```

Si le dépôt a déjà des commits, synchroniser avant de pousser.

## 4. Vercel

Dans le projet Vercel `syncore-analytics` existant, relier le dépôt GitHub et vérifier :

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`
- `PAGESPEED_API_KEY` : optionnelle (clé Google Cloud si nécessaire, à conserver **uniquement côté serveur**)

Puis déployer. Aucun changement à Syncore Monitor.

## Limites et sécurité de cette V1

- La page publique appelle l'API PageSpeed côté serveur. Google peut imposer quotas, erreurs temporaires et limites d'analyse. Les analyses peuvent prendre du temps.
- Limiteur rudimentaire en mémoire (5 analyses/heure/IP/instance), **non fiable sur plusieurs instances Vercel** : avant un usage public important, ajouter un rate limiter partagé (Redis/KV), une protection anti-bot et une surveillance des quotas.
- Validation d'URL basique : bloque les hôtes privés les plus évidents ; pour un service public à grande échelle, ajouter des protections SSRF renforcées, y compris validation DNS/redirections ou déléguer exclusivement au fournisseur sans possibilité de fetch interne.
- Rapports PDF générés dans le navigateur depuis les résultats affichés ; ils ne sont pas archivés.
- GA4, Search Console, Clarity, historique Supabase et Excel ne sont **pas encore intégrés**.
- Ne jamais placer de clé secrète Supabase ou Google dans `NEXT_PUBLIC_*`.
