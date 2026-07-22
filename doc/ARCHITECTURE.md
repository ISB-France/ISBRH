# Architecture & mode d'emploi

## Structure du projet

```
├── app/
│   ├── backend/          # Django 5
│   │   ├── config/       # Settings, URLs, WSGI
│   │   └── apps/
│   │       ├── users/    # Auth, utilisateurs, sites, services, positions
│   │       └── interviews/ # Entretiens, campagnes, modèles
│   └── frontend/         # React + TypeScript + Vite
│       └── src/
│           ├── components/    # Composants réutilisables
│           ├── components/ui/ # Primitives shadcn/ui
│           ├── contexts/      # Contextes React (thème)
│           ├── pages/         # Pages de l'application
│           └── lib/           # Utilitaires
├── doc/                  # Documentation
│   └── guides/           # Guides (Entra ID, branches)
├── docker-compose.dev.yml # 4 services (dev local) : db, backend, frontend, adminer
└── .env                  # Variables d'environnement
```

---

## Backend — Django

### Modèles principaux

#### User (utilisateur)
- **Identité** : email, nom, prénom, sexe, date naissance, téléphone, photo, icon (émoji)
- **Contrat** : matricule, date embauche/sortie, type contrat (CDI/CDD/intérim/alternance/stage), statut (actif/inactif/sortie), coefficient, niveau, fonctionnement, salaire brut, forfait jour, tickets resto, cadre
- **Organisation** : service (FK), poste (FK), site (FK), manager (FK vers User), agence intérim
- **Auth** : rôle (admin/rh/manager/employee/stagiaire/alternant), onboarding_status
- **Préférences** : champ JSON `preferences` (stocke le thème couleur, etc.)

#### Interview (entretien)
- employee (FK User), manager (FK User)
- campaign (FK), template (FK)
- type : annual / professional / bilan / forfait / fin_carriere
- status : draft / in_progress / completed / signed / cancelled
- content : JSON (réponses aux questions)
- document : fichier uploadé
- Signature électronique via checkbox
- À la création (unitaire ou via génération de campagne), `apply_default_sections()` (`apps/interviews/views.py`) complète automatiquement les sections issues du template :
  - une section **"Commentaire"** (id `commentaires`) est ajoutée si absente, avec deux questions textarea fixes : `commentaire_collaborateur` ("Commentaire du collaborateur") et `commentaire_manager` ("Commentaire du manager")
  - toute question de type `table` sans réponse démarre avec **5 lignes vides** par défaut (au lieu de 0)
- À la finalisation (passage à `completed`), le frontend (`InterviewDetail.tsx`) détecte les lignes de tableau restées vides (5 par défaut ou ajoutées manuellement) et affiche une confirmation avant de finaliser ; les lignes vides sont supprimées automatiquement si l'utilisateur confirme

#### Campaign (campagne)
- nom, description, template (FK)
- dates début/échéance
- population_filter : JSON (site, service, employés spécifiques)
- Action `generate` : crée les entretiens pour la population ciblée

#### InterviewTemplate (modèle d'entretien)
- nom, type
- sections : JSON (liste de sections avec questions)
  - Types de questions : textarea / rating (1-5) / table (colonnes personnalisables)
  - Les sections/questions sont ordonnées

#### Modèles d'organisation
- **Site** : nom, adresse
- **Service** : nom
- **Position** : nom

#### Notification
- user (FK), message, link, read (bool), created_at
- Créées par signaux Django (création entretien, complétion, signature)
- Commande management `check_upcoming` : notifications pour les entretiens à échéance proche

### API REST

| Endpoint | Méthodes | Description |
|---|---|---|
| `/api/auth/me/` | GET, PATCH | Profil utilisateur courant |
| `/api/token/` | POST | JWT login |
| `/api/token/refresh/` | POST | Rafraîchir JWT |
| `/api/users/` | GET, POST | Liste/création utilisateurs |
| `/api/users/{id}/` | GET, PUT, PATCH, DELETE | Détail/modification utilisateur |
| `/api/users/import_kostango/` | POST | Import utilisateurs (Kostango) |
| `/api/users/import_collaborateurs/` | POST | Import collaborateurs |
| `/api/users/import_formations/` | POST | Import formations |
| `/api/users/import_augmentations/` | POST | Import augmentations |
| `/api/users/next_matricule/` | GET | Prochain matricule disponible |
| `/api/interviews/` | GET, POST | Liste/création entretiens |
| `/api/interviews/{id}/` | GET, PUT, PATCH, DELETE | Détail/modification entretien |
| `/api/interviews/{id}/print/` | GET | Version print d'un entretien |
| `/api/interviews/{id}/pdf/` | GET | Génération PDF (WeasyPrint) |
| `/api/interviews/stats/` | GET | Statistiques (total, par statut, etc.) |
| `/api/interviews/employees/` | GET | Liste des employés pour le manager courant |
| `/api/campaigns/` | GET, POST | Campagnes |
| `/api/campaigns/{id}/generate/` | POST | Générer les entretiens d'une campagne |
| `/api/interview-templates/` | GET, POST | Modèles d'entretien |
| `/api/sites/` | GET | Sites |
| `/api/services/` | GET, POST | Services |
| `/api/positions/` | GET, POST | Postes |
| `/api/notifications/` | GET | Notifications |
| `/api/notifications/{id}/mark-read/` | POST | Marquer comme lu |

### Sérialiseurs

- **UserSerializer** : utilisé pour la liste/détail utilisateurs — inclut `site_name`, `service_name`, `position_name`, `manager_name` (read-only)
- **UserMeSerializer** : utilisé pour `/auth/me/` — inclut en plus les compteurs d'entretiens
- **InterviewSerializer** : entretiens avec réponses, documents, infos employé/manager
- **CampaignSerializer** : campagnes avec filtre de population

---

## Frontend — React

### Architecture des pages

```
/login                  → LoginPage          (auth Microsoft + dev)
/auth/callback          → AuthCallback       (stocke les tokens JWT)
/dashboard              → Dashboard          (stats, tableau des entretiens)
/interviews             → Interviews         (liste avec filtres, actions)
/interviews/new         → InterviewForm      (création)
/interviews/:id         → InterviewDetail    (formulaire de réponse)
/interviews/:id/edit    → InterviewForm      (édition)
/campaigns              → Campaigns          (liste)
/campaigns/new          → CampaignForm       (création)
/campaigns/:id          → CampaignDetail     (détail, génération)
/campaigns/:id/edit     → CampaignForm       (édition)
/templates              → Templates          (liste)
/templates/new          → TemplateForm       (création)
/templates/:id/edit     → TemplateForm       (édition)
/users                  → Users              (liste, arbre N-1)
/users/new              → UserForm           (création)
/users/:id/edit         → UserForm           (édition)
/profile                → Profile            (avatar, émoji, thème)
```

### Contexte et état global

- **ColorThemeContext** : 14 thèmes couleur, injecte les variables CSS HSL dynamiquement, persiste dans localStorage + API (via `preferences`)
- **TanStack React Query** : tous les appels API passent par React Query (cache, refetch, loading/error states)
- **Axios** : instance avec interceptor JWT (refresh automatique)

### Composants clés

- **AppLayout** : layout authentifié avec sidebar (Dashboard, Entretiens, Campagnes, Modèles, Utilisateurs) + topbar (notifications, profil, logout)
- **ThemeSync** : synchronise le thème depuis les préférences utilisateur au premier chargement
- **LoadingScreen / ErrorScreen** : états de chargement et d'erreur globaux
- **ConfirmDialog** : boîte de confirmation modale (natif `<dialog>`)

### Thèmes couleur

14 thèmes disponibles, chacun décliné en mode clair et sombre :
ISB, Blue, Green, Purple, Red, Teal, Pink, Slate, Midnight, Charcoal, Forest, Plum, Navy, Wine

Le thème actif est :
1. Appliqué immédiatement via `localStorage` (au changement dans le profil)
2. Sauvegardé en base via `PATCH /auth/me/` (dans le JSON `preferences`)
3. Restauré depuis l'API si `localStorage` est vide (nouvel appareil)

---

## Mode d'emploi

### Développement

```bash
docker compose -f docker-compose.dev.yml up -d                          # Lancer tous les services
docker compose -f docker-compose.dev.yml logs -f backend                # Voir les logs backend
docker compose -f docker-compose.dev.yml exec backend python manage.py migrate   # Migrations
docker compose -f docker-compose.dev.yml exec backend python manage.py createsuperuser  # Admin
docker compose -f docker-compose.dev.yml restart backend                # Redémarrer un service
```

Le premier utilisateur créé (via le login dev) reçoit automatiquement le rôle RH.

### Connexion OIDC / Microsoft Entra ID

1. Remplir les variables `OIDC_*` dans `.env` (voir [doc/guides/ENTRA_ID_SETUP.md](guides/ENTRA_ID_SETUP.md))
2. Les variables actuelles pointent sur un tenant Azure actif
3. En dev, utiliser le login par email sur `/login` (pas besoin d'Entra ID)

### Imports CSV

Quatre imports sont disponibles depuis la page **Utilisateurs** (réservé aux rôles RH/Admin) :

| Import | Endpoint | Clé |
|---|---|---|
| Utilisateurs (Kostango) | `POST /api/users/import_kostango/` | email |
| Collaborateurs | `POST /api/users/import_collaborateurs/` | matricule |
| Formations | `POST /api/users/import_formations/` | matricule |
| Augmentations | `POST /api/users/import_augmentations/` | matricule |

Voir [doc/IMPORTS.md](IMPORTS.md) pour le détail des colonnes, exemples et FAQ.

### Entretiens

1. Créer un **modèle** (template) avec des sections et questions
2. Créer une **campagne** (ou un entretien individuel)
3. Le **manager** remplit l'entretien avec le collaborateur
4. Signature : l'employé coche "J'ai pris connaissance", le manager finalise

Types d'entretiens supportés :
- **Annual** : entretien annuel d'évaluation
- **Professional** : entretien professionnel (évolution de carrière)
- **Bilan** : bilan de compétences / mi-carrière
- **Forfait** : entretien forfait-jour (convention SYNTEC)
- **Fin carrière** : entretien de fin de carrière

### Notifications

Les notifications sont créées automatiquement quand :
- Un entretien est créé pour un employé → notifie son manager
- Un entretien est complété → notifie le manager
- Un entretien est signé → notifie le manager
- Un entretien approche de sa date d'échéance → notifie le manager (commande `check_upcoming`)

### Commandes utiles

```bash
# Créer les notifications d'échéance
docker compose -f docker-compose.dev.yml exec backend python manage.py check_upcoming

# Ouvrir une session shell Django
docker compose -f docker-compose.dev.yml exec backend python manage.py shell

# Voir les logs d'un service
docker compose -f docker-compose.dev.yml logs -f backend
docker compose -f docker-compose.dev.yml logs -f frontend

# Redémarrer tous les services
docker compose -f docker-compose.dev.yml restart

# Rebuild après modification des dépendances
docker compose -f docker-compose.dev.yml up -d --build backend
```
