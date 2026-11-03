# Mise en place des rôles

1. Déployer le code et exécuter `supabase/migrations/003_roles.sql` dans le SQL Editor du projet Supabase existant (après 001).
2. Dans Supabase Authentication > Users, vérifier que le compte principal existe et qu'il figure dans `public.admin_users`.
3. Exécuter séparément dans le SQL Editor en remplaçant l'adresse :

```sql
update public.admin_users set role = 'owner', active = true
where user_id = (select id from auth.users where lower(email) = lower('VOTRE_EMAIL'));
```

4. Vérifier le résultat : `select user_id, role, active from public.admin_users;` ; il doit y avoir un seul `owner`.
5. Configurer sur Vercel `SUPABASE_SERVICE_ROLE_KEY` côté serveur uniquement. Ne jamais l'exposer dans une variable `NEXT_PUBLIC_`.
6. Se connecter sur `/login`, puis accéder à `/admin/utilisateurs` pour créer les administrateurs et le directeur.

**Sécurité :** les comptes sont créés côté serveur avec la clé service role, après contrôle du rôle `owner` via la session Supabase. Les comptes désactivés n'ont plus accès aux espaces privés à la prochaine vérification serveur. Pour une révocation immédiate de sessions déjà ouvertes, configurer aussi une politique de révocation des sessions Supabase. L'interface ne permet jamais de créer un second owner.

**Limites de cette étape :** gestion des comptes et rôles uniquement. Les affectations de sites et leurs politiques RLS seront réalisées avec le module de gestion des sites ; ne pas exposer les données des sites avant la mise en place de ces politiques. Les anciennes routes d'analyse publiques sont inchangées.
