# Lot B — autorisation des navigateurs (Preview)

1. Exécuter security_devices.sql dans Supabase SQL Editor après revue. Préférer une base de test. La migration ajoute une table sans accès anon/authenticated.
2. Copier les fichiers, npx tsc --noEmit puis npm run build. Déployer sur la branche feat/enterprise-security.
3. Garder REQUIRE_MFA=true. Ajouter REQUIRE_DEVICE_APPROVAL=true uniquement en Preview, puis redeployer. Utiliser une URL Preview stable (les cookies sont propres au domaine).
4. Se connecter et valider le MFA. Sur /appareil cliquer Demander ou verifier mon autorisation. Noter l'identifiant de demande affiché. Ne pas approuver une demande inconnue.
5. Initialisation manuelle : dans Supabase SQL Editor, vérifier l'identifiant exact et l'identité owner :

```sql
select d.id,d.user_id,d.status,d.environment,u.role,u.active
from public.security_devices d join public.admin_users u on u.user_id=d.user_id
where d.id='UUID_DE_LA_DEMANDE';
```

Puis, seulement si la demande est bien celle du navigateur que vous contrôlez :

```sql
update public.security_devices d set status='approved', decided_at=now(), decided_by=d.user_id
where d.id='UUID_DE_LA_DEMANDE' and d.environment='preview' and d.status='pending'
and exists (select 1 from public.admin_users u where u.user_id=d.user_id and u.role='owner' and u.active=true)
returning id,status;
```

6. Recliquer sur le bouton de vérification. Accéder à /admin/appareils. Garder ce navigateur ouvert. Tester dans un autre navigateur : MFA, demande, accès direct /admin et /api/admin/users refusés, puis approbation de l'identifiant exact depuis le premier navigateur. Tester révocation et refus. Ne pas partager les cookies.
7. Vérifier les intégrations, rapports et audits. Vérifier security_events (device_decision). Les décisions SQL manuelles ne sont pas journalisées automatiquement.

Récupération : si tous les navigateurs owner sont perdus, répéter l'approbation SQL manuelle après contrôle d'identité. Ne pas désactiver MFA. Le cookie opaque expire après 90 jours, et sa suppression nécessite une nouvelle demande. La déconnexion conserve l'autorisation du navigateur, mais pas la session. Ce n'est pas une attestation matérielle. Les autorisations Preview et Production sont séparées. Pas de notification externe ni de step-up supplémentaire dans ce lot. Les accès directs à Supabase nécessitent une revue RLS distincte. Ne pas fusionner avant validation. Compilation et tests réels non exécutés dans l'environnement de livraison.
