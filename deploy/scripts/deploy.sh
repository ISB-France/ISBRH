#!/usr/bin/env bash
# Appelé par GitHub Actions
# Usage: deploy.sh <prod|recette>
set -euo pipefail

ENV=$1
if [[ "$ENV" != "prod" && "$ENV" != "recette" ]]; then
  echo "Usage: $0 <prod|recette>" >&2
  exit 1
fi

if [ "$ENV" = "prod" ]; then
  DEPLOY_PATH="$DEPLOY_PATH_PROD"
  COMPOSE_FILE="deploy/docker-compose.prod.yml"
  ENV_FILE=".env.prod"
else
  DEPLOY_PATH="$DEPLOY_PATH_RECETTE"
  COMPOSE_FILE="deploy/docker-compose.recette.yml"
  ENV_FILE=".env.recette"
fi

cd "$DEPLOY_PATH"

git pull origin "$ENV"

docker compose -f "$COMPOSE_FILE" --env-file "$ENV_FILE" -p "isbrh-$ENV" up -d --build

docker image prune -f

echo "✅ Déploiement $ENV terminé sur $DEPLOY_PATH"
