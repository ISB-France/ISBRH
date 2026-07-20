#!/usr/bin/env bash
set -euo pipefail

# ──────────────────────────────────────────────
# Script d'initialisation du serveur
# À exécuter UNE SEULE FOIS sur la machine cible
# ──────────────────────────────────────────────

if [ "$(id -u)" -ne 0 ]; then
  echo "Ce script doit être exécuté en root (sudo)." >&2
  exit 1
fi

# ── 1. Prérequis système ──
apt-get update
apt-get install -y --no-install-recommends \
  docker.io \
  docker-compose-v2 \
  nginx \
  apache2-utils \
  git

systemctl enable --now docker

# ── 2. Création des dossiers ──
mkdir -p /var/www/app-prod
mkdir -p /var/www/app-recette
mkdir -p /etc/isbrh

# ── 3. Clonage du repo (production) ──
if [ ! -d /var/www/app-prod/.git ]; then
  git clone -b main \
    git@github.com:ISB-France/ISBRH.git \
    /var/www/app-prod
fi

# ── 4. Clonage du repo (recette) ──
if [ ! -d /var/www/app-recette/.git ]; then
  git clone -b recette \
    git@github.com:ISB-France/ISBRH.git \
    /var/www/app-recette
fi

# ── 5. Configuration Nginx ──
cp /var/www/app-prod/deploy/nginx/prod.conf    /etc/nginx/sites-available/monapp
cp /var/www/app-prod/deploy/nginx/recette.conf /etc/nginx/sites-available/recette.monapp

ln -sf /etc/nginx/sites-available/monapp        /etc/nginx/sites-enabled/
ln -sf /etc/nginx/sites-available/recette.monapp /etc/nginx/sites-enabled/

# ── 6. Protection par mot de passe pour la recette ──
htpasswd -cb /etc/nginx/.htpasswd-recette admin "changeme-please"

# ── 7. Droits SSH pour le deploy ──
# Créer une paire de clés si elle n'existe pas
if [ ! -f /root/.ssh/deploy-key ]; then
  ssh-keygen -t ed25519 -f /root/.ssh/deploy-key -N "" -C "github-actions-deploy"
  echo ">>> Ajoute cette clé publique dans les Deploy Keys du repo GitHub :"
  cat /root/.ssh/deploy-key.pub
fi

# ── 8. Redémarrage Nginx ──
nginx -t && systemctl enable --now nginx

# ── 9. Fichier .env.prod ──
mkdir -p /etc/isbrh
if [ ! -f /etc/isbrh/prod.env ]; then
  cp /var/www/app-prod/deploy/.env.prod.example /etc/isbrh/prod.env
  echo ">>> Édite /etc/isbrh/prod.env avec tes vraies valeurs"
fi

# ── 10. Fichier .env.recette ──
if [ ! -f /etc/isbrh/recette.env ]; then
  cp /var/www/app-recette/deploy/.env.recette.example /etc/isbrh/recette.env
  echo ">>> Édite /etc/isbrh/recette.env avec tes vraies valeurs"
fi

echo ""
echo "=== Setup terminé ! ==="
echo "1. Édite les fichiers /etc/isbrh/prod.env et /etc/isbrh/recette.env"
echo "2. Ajoute la clé publique ci-dessus dans GitHub Deploy Keys"
echo "3. Ajoute les secrets GitHub (SSH_HOST, SSH_USER, SSH_PRIVATE_KEY, DEPLOY_PATH_PROD, DEPLOY_PATH_RECETTE)"
echo "4. Lance le premier déploiement manuel depuis GitHub Actions"
