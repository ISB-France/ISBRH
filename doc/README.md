# Templates d'import

Ce dossier contient les modèles Excel à utiliser pour les imports de masse de l'application. Chaque template correspond à un bouton/option d'import précis dans l'UI, et à un endpoint API dédié.

## Page Utilisateurs (`/users`)

| Fichier | Option d'import (UI) | Endpoint API | Usage |
|---|---|---|---|
| `template_utilisateurs.xlsx` | Import utilisateurs | `POST /api/users/import_kostango/` | Import/synchronisation des utilisateurs depuis un export Kostango (crée ou met à jour les comptes : email, poste, site, contrat, valideur N+1, etc.) |
| `template_evolution_professionnelle.xlsx` | Import évolution professionnelle | `POST /api/users/import_collaborateurs/` | Met à jour l'état COURANT des fiches collaborateurs à partir du matricule (nom, prénom, dates, statut, niveau, coefficient, poste, fonctionnement) |
| `template_formations.xlsx` | Import formations | `POST /api/users/import_formations/` | Ajoute des formations suivies à l'historique d'un collaborateur, identifié par matricule |
| `template_augmentations.xlsx` | Import augmentations | `POST /api/users/import_augmentations/` | Ajoute des augmentations salariales à l'historique d'un collaborateur, identifié par matricule |
| `template_evolutions_historique.xlsx` | Import évolutions historique | `POST /api/users/import_evolutions/` | Ajoute des évolutions HISTORIQUE datées (poste, service, site, statut, niveau, coefficient ou salaire) à la fiche d'un collaborateur, identifié par matricule — à ne pas confondre avec l'évolution professionnelle ci-dessus, qui met à jour l'état courant |

## Page Entretiens (`/interviews`)

| Fichier | Option d'import (UI) | Endpoint API | Usage |
|---|---|---|---|
| `template_entretiens_historique.xlsx` | Importer historique d'entretiens | `POST /api/interviews/import_historique/` | Importe en masse des entretiens passés (métadonnées uniquement) : matricule, état, date prévue, date de réalisation, type d'entretien |

## Page Modèles (`/templates`)

| Fichier | Option d'import (UI) | Endpoint API | Usage |
|---|---|---|---|
| `template_objectifs_a_evaluer.xlsx` | Importer objectifs à évaluer | `POST /api/interviews/import_objectifs_a_evaluer/` | Ajoute des lignes au tableau "Objectif à évaluer" de l'entretien d'évaluation le plus récent (non signé, non annulé) d'un collaborateur : matricule, définition, thème, date de réalisation |
| `template_listes_exemple.xlsx` | Importer des listes de choix | `POST /api/answer-lists/import_csv/` | Crée ou met à jour des listes de choix réutilisables dans les questions/colonnes de type liste |

## Format général

Chaque fichier suit la même structure :
- **Ligne 1-2** : titre et instructions.
- **Ligne 4** : en-têtes de colonnes (à conserver telles quelles, ce sont les clés attendues par l'API).
- **Ligne 5** : exemple de donnée, à remplacer par vos lignes réelles.
- **Lignes suivantes (à partir de la ligne 5)** : vos données, une ligne par enregistrement.

Le fichier est ensuite exporté en **CSV** (encodage UTF-8) avant d'être envoyé via le formulaire d'import correspondant — les endpoints backend attendent un CSV, pas un `.xlsx` brut.

## Détail des colonnes

### `template_evolutions_historique.xlsx`
| Colonne | Description |
|---|---|
| Matricule | Matricule du collaborateur (doit déjà exister) |
| Type | `poste`, `service`, `site`, `statut`, `niveau`, `coefficient` ou `salaire` |
| Ancienne valeur | Valeur avant le changement |
| Nouvelle valeur | Valeur après le changement |
| Date d'effet | Date d'effet (JJ/MM/AAAA) |

Voir les autres templates pour le détail de leurs colonnes respectives (section "Description des colonnes" en bas de chaque fichier).
