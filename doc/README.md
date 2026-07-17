# Templates d'import — page /users

Ce dossier contient les modèles Excel à utiliser pour les imports de masse disponibles sur la page **Utilisateurs** (`/users`). Chaque template correspond à une des 5 options du menu déroulant d'import, et à un endpoint API dédié (`POST /api/users/<action>/`).

| Fichier | Option d'import (UI) | Endpoint API | Usage |
|---|---|---|---|
| `template_utilisateurs_kostango.xlsx` | Import utilisateurs | `import_kostango` | Import/synchronisation des utilisateurs depuis un export Kostango (crée ou met à jour les comptes : email, poste, site, contrat, valideur N+1, etc.) |
| `template_collaborateurs.xlsx` | Import évolution professionnelle | `import_collaborateurs` | Crée ou met à jour les fiches collaborateurs à partir du matricule (nom, prénom, dates, statut, niveau, coefficient, poste, fonctionnement) |
| `template_formations.xlsx` | Import formations | `import_formations` | Ajoute des formations suivies à l'historique d'un collaborateur, identifié par matricule |
| `template_augmentations.xlsx` | Import augmentations | `import_augmentations` | Ajoute des augmentations salariales à l'historique d'un collaborateur, identifié par matricule |
| `template_evolutions.xlsx` | Import évolutions (historique) | `import_evolutions` | Ajoute des évolutions historiques (poste, service, site, statut, niveau, coefficient ou salaire) à la fiche d'un collaborateur, identifié par matricule |

## Format général

Chaque fichier suit la même structure :
- **Ligne 1-2** : titre et instructions.
- **Ligne 4** : en-têtes de colonnes (à conserver telles quelles, ce sont les clés attendues par l'API).
- **Ligne 5** : exemple de donnée, à remplacer par vos lignes réelles.
- **Lignes suivantes (à partir de la ligne 5)** : vos données, une ligne par enregistrement.

Le fichier est ensuite exporté en **CSV** (encodage UTF-8) avant d'être envoyé via le formulaire d'import de `/users` — les endpoints backend attendent un CSV, pas un `.xlsx` brut.

## Détail des colonnes

### `template_evolutions.xlsx`
| Colonne | Description |
|---|---|
| Matricule | Matricule du collaborateur (doit déjà exister) |
| Type | `poste`, `service`, `site`, `statut`, `niveau`, `coefficient` ou `salaire` |
| Ancienne valeur | Valeur avant le changement |
| Nouvelle valeur | Valeur après le changement |
| Date d'effet | Date d'effet (JJ/MM/AAAA) |

Voir les autres templates pour le détail de leurs colonnes respectives (section "Description des colonnes" en bas de chaque fichier).
