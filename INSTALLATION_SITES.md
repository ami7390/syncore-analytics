# Étape 2 — Gestion des sites

1. Dans Supabase SQL Editor, exécuter `supabase/migrations/004_sites.sql` **une seule fois**. Ce script ne modifie pas les tables d'authentification ou Lighthouse.
2. Copier les fichiers du correctif dans le dépôt en conservant les chemins.
3. Déployer sur Vercel (aucune nouvelle variable nécessaire).
4. Connecté comme `owner`, ouvrir `/admin/sites` pour ajouter des sites et attribuer les comptes `admin` actifs.
5. Tester avec un compte `admin` (uniquement ses sites) et `director` (lecture seule de tous les sites).

**Sécurité** : les tables ne sont pas accessibles directement depuis le navigateur ; les routes Next.js vérifient les rôles et utilisent la clé service-role uniquement côté serveur. Les URLs sont des fiches de sites, elles ne déclenchent pas de requête réseau. L'intégration du worker Lighthouse à ces fiches est une étape ultérieure.

**Limite** : la mise à jour des affectations remplace les lignes côté API ; pour une garantie transactionnelle absolue en cas d'erreur concurrente, utiliser ultérieurement une fonction SQL transactionnelle.
