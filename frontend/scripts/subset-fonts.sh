#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────────────────
# Subset the heavy CJK display font down to ONLY the glyphs we actually render.
#
# Why: `寒蝉宽黑体(Chill K Sans).otf` is 9.9 MB but is used in exactly ONE place —
# the Chinese hero wordmark in HeroSection.vue, which renders the two
# characters "艺芽". Shipping the full 9.9 MB OTF to every visitor saturated
# the connection and made the homepage take ~50 s to load.
#
# This produces a WOFF2 that contains just those glyphs (~a few KB).
#
# Requires: fonttools (pyftsubset) with brotli  →  `pip install fonttools brotli`
#
# If the hero wordmark text ever changes, update GLYPHS below and re-run:
#   bash scripts/subset-fonts.sh
# ──────────────────────────────────────────────────────────────────────────
set -euo pipefail

FONT_DIR="$(cd "$(dirname "$0")/.." && pwd)/src/assets/styles/fonts"
SRC="$FONT_DIR/寒蝉宽黑体(Chill K Sans).otf"
OUT="$FONT_DIR/chill-k-sans-subset.woff2"

# Glyphs rendered with 'Chill K Sans' (home.hero.titleArt + titleBloom).
GLYPHS="艺芽"

pyftsubset "$SRC" \
  --text="$GLYPHS" \
  --flavor=woff2 \
  --layout-features='*' \
  --output-file="$OUT"

echo "Subset font written to: $OUT"
ls -lh "$OUT"
