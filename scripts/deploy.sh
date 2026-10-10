#!/usr/bin/env bash
# Build and publish dist/ to the gh-pages branch (served by GitHub Pages).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
rev=$(git rev-parse --short HEAD)
tmp=$(mktemp -d)
cp -r dist/. "$tmp"
touch "$tmp/.nojekyll"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="deploy" -c user.email="deploy@localhost" commit -qm "Deploy $rev"
git push -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
echo "Deployed $rev"
