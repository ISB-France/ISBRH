# ISBRH

Gestion des entretiens annuels et professionnels — ISB France.

## Stack

- **Backend** : Django 5 + Django REST Framework + mozilla-django-oidc
- **Frontend** : React 19 + TypeScript + Vite 6 + Tailwind CSS 3
- **Base de données** : PostgreSQL 16
- **Auth** : OIDC + dev login (email)
- **Déploiement** : Docker

## Démarrage rapide

```bash
cp .env.example .env        # puis remplir les variables
docker compose up -d        # lance db + backend + frontend + adminer
```

- Frontend : http://localhost:5175
- Backend API : http://localhost:8002
- Adminer (DB) : http://localhost:8080

## Utilisateurs et rôles

| Rôle | Droits |
|---|---|
| **Admin** | Accès complet (CRUD utilisateurs, campagnes, modèles, entretiens) |
| **RH** | CRUD utilisateurs, campagnes, modèles, entretiens |
| **Manager** | Gère ses entretiens + ceux de ses N-1, voit sa hiérarchie |
| **Employé / Stagiaire / Alternant** | Accès limité à ses entretiens |

> En dev, utilisez le login par email (`/login`). Le premier compte créé reçoit le rôle RH.

## Fonctionnalités principales

| Module | Description |
|---|---|
| **Entretiens** | Annuels, professionnels, bilans, forfait-jour, fin de carrière |
| **Campagnes** | Génération automatisée d'entretiens par filtre de population |
| **Modèles** | Templates personnalisables (sections, questions textes/notes/tableaux) |
| **Utilisateurs** | Fiche complète (identité, contrat, organisation), import CSV, arbre N-1 |
| **Thèmes** | 14 thèmes couleur personnalisables, liés au compte |
| **PDF** | Génération PDF via WeasyPrint |
| **Notifications** | Alertes pour les managers (relances, signatures) |
## Architecture détaillée

→ [doc/ARCHITECTURE.md](doc/ARCHITECTURE.md)

## Licence

Voir [LICENSE](LICENSE).
