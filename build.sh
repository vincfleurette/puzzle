#!/bin/bash

# Génère une version basée sur le timestamp du déploiement
VERSION=$(date +%Y%m%d-%H%M%S)

# Si on est sur Cloudflare Pages avec Git, utilise le commit SHA
if [ ! -z "$CF_PAGES_COMMIT_SHA" ]; then
  VERSION="${CF_PAGES_COMMIT_SHA:0:8}"
fi

echo "🔨 Building with version: $VERSION"

# Remplace la version dans index.html
sed -i "s/window\.APP_VERSION = '[^']*'/window.APP_VERSION = '$VERSION'/g" index.html

echo "✅ Build complete!"