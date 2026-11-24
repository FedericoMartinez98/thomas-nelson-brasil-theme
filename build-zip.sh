#!/usr/bin/env bash
# Builds the uploadable Shopify theme zip (theme folders at the zip root).
set -euo pipefail
cd "$(dirname "$0")/shopify-theme"
mkdir -p ../dist && rm -f ../dist/tn-brasil-theme.zip
zip -qr ../dist/tn-brasil-theme.zip layout config locales sections snippets templates assets -x '*.DS_Store'
echo "dist/tn-brasil-theme.zip"
