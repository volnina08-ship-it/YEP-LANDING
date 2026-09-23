#!/usr/bin/env bash
# Letölti a megosztott Dropbox mappát zip-ként és kicsomagolja a media-source mappába.
# Használat:  npm run media:fetch            (alapértelmezett YEP referencia mappa)
#             bash scripts/fetch-dropbox.sh "https://www.dropbox.com/scl/fo/…?rlkey=…&dl=0"
set -euo pipefail

URL="${1:-https://www.dropbox.com/scl/fo/807aqktpagb0fzugi22hq/AI-ZIAuXpTVpyXpekyB3yUU?rlkey=924a86jwukjwlllk7e6d5ullt&st=tj244ku7&dl=0}"
URL="${URL//dl=0/dl=1}"
DEST="media-source"
TMP="$(mktemp -d)"

mkdir -p "$DEST"
echo "▸ Letöltés a Dropbox-ról…"
curl -L --fail --progress-bar "$URL" -o "$TMP/dropbox.zip"
echo "▸ Kicsomagolás → $DEST"
unzip -o -q "$TMP/dropbox.zip" -d "$DEST"
rm -rf "$TMP"
find "$DEST" -name '__MACOSX' -prune -exec rm -rf {} + 2>/dev/null || true
echo "✔ Kész. Következő lépés:  npm run media"
