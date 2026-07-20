# Déploiement — WorkIsBeautiful

## Architecture

```
                   Serveur unique
               ┌──────────────────────┐
               │   Nginx (80/443)     │
               │  reverse proxy       │
               └──┬───────────────┬───┘
                  │               │
          monapp.com        recette.monapp.com
          ┌─────────┐      ┌───────────┐
          │ :3000   │      │ :3001     │
          │ prod    │      │ recette   │
          └─────────┘      └───────────┘
```

## Dossiers

| Environnement | Chemin code | Fichier .env | Branche |
|---|---|---|---|
| Production | `/var/www/app-prod` | `/etc/workisbeautiful/prod.env` | `main` |
| Recette | `/var/www/app-recette` | `/etc/workisbeautiful/recette.env` | `recette` |

## Workflow Git

```
dev ──→ recette ──→ main
  (dev)   (test)    (prod)
```

1. **dev** — développement quotidien
2. **recette** — tests, validation (push → déploiement auto + CI)
3. **main** — production (push → déploiement auto + CI)

## Setup serveur

```bash
# 1. Exécuter le script d'initialisation (une seule fois)
sudo bash /var/www/app-prod/deploy/scripts/setup-server.sh

# 2. Éditer les fichiers .env (hors du dossier servi)
nano /etc/workisbeautiful/prod.env
nano /etc/workisbeautiful/recette.env

# 3. Ajouter les secrets dans GitHub
# Settings → Secrets and variables → Actions
```

## Secrets GitHub requis

| Secret | Description |
|---|---|
| `SSH_HOST` | IP du serveur |
| `SSH_USER` | Utilisateur SSH |
| `SSH_PRIVATE_KEY` | Clé privée SSH |
| `DEPLOY_PATH_PROD` | `/var/www/app-prod` |
| `DEPLOY_PATH_RECETTE` | `/var/www/app-recette` |

## Commandes utiles

```bash
# Voir les logs d'un environnement
docker compose -p workisbeautiful-prod logs -f
docker compose -p workisbeautiful-recette logs -f

# Redémarrer un environnement
docker compose -p workisbeautiful-prod restart

# Stopper un environnement
docker compose -p workisbeautiful-recette down
```
