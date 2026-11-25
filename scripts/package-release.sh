#!/usr/bin/env bash
# Build and package a complete, checksummed release without publishing it.
# Usage: ./scripts/package-release.sh [version] [output-dir]
set -euo pipefail

ROOT=$(pwd)
VERSION=${1:-$(node -p "require('./package.json').version")}
OUT=${2:-dist-release}
OUT_ABS="$ROOT/$OUT"

echo "== Verifying =="
npm run check
npm run test
npm run build

echo "== Packaging v$VERSION =="
rm -rf "$OUT_ABS"
mkdir -p "$OUT_ABS"

tar -czf "$OUT_ABS/source-v$VERSION.tar.gz" \
  --exclude=node_modules --exclude=.git --exclude=.svelte-kit \
  --exclude=build --exclude="$OUT" .

(cd "$ROOT/apps/coreskills/build" && zip -qr "$OUT_ABS/coreskills-v$VERSION.zip" .)
(cd "$ROOT/apps/corebase/build" && zip -qr "$OUT_ABS/corebase-v$VERSION.zip" .)

(cd "$OUT_ABS" && sha256sum * > SHA256SUMS.txt)
echo "Release artifacts in $OUT_ABS"
cat "$OUT_ABS/SHA256SUMS.txt"
