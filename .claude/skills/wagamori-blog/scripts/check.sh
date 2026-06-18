#!/usr/bin/env bash
# Wagamori blog self-check — run BEFORE zipping a post.
# Usage: bash scripts/check.sh [POST_DIR]   (default: current dir)
# Exits 0 only if all hard checks (✗) pass; ⚠ are warnings (non-fatal).
set -u

POST="${1:-.}"
cd "$POST" 2>/dev/null || { echo "❌ no such dir: $POST"; exit 2; }

# locate the markdown entry (index.md preferred)
MD="index.md"
[ -f "$MD" ] || MD="$(ls -1 *.md 2>/dev/null | head -1)"
[ -n "${MD:-}" ] && [ -f "$MD" ] || { echo "❌ no .md file in $POST"; exit 2; }

echo "== $POST ($MD) =="
echo "-- files --"; find . -type f ! -name '.*' | sort | sed 's/^/   /'

ok=1

# 1) every body ref ![..](images/..) or (cover.*) must exist on disk
echo "-- references --"
refs="$(grep -oE '\]\((images/[^)]+|cover\.[a-z]+)\)' "$MD" | sed -E 's/^\]\(//; s/\)$//')"
if [ -n "$refs" ]; then
  while IFS= read -r r; do
    [ -z "$r" ] && continue
    if [ -f "$r" ]; then echo "   ✓ $r"; else echo "   ✗ MISSING ref: $r"; ok=0; fi
  done <<EOF
$refs
EOF
else
  echo "   (no inline image refs found)"
fi

# 2) frontmatter cover must exist
cov="$(grep -m1 -E '^cover:' "$MD" | sed -E 's/^cover:[[:space:]]*//; s/["'"'"' ]//g')"
if [ -n "$cov" ]; then
  [ -f "$cov" ] && echo "   ✓ cover $cov" || { echo "   ✗ MISSING cover: $cov"; ok=0; }
else
  echo "   ✗ no 'cover:' in frontmatter"; ok=0
fi

# 3) at least 2 inline images present (图文并茂)
n="$(ls images/ 2>/dev/null | grep -ciE '\.(jpe?g|png|webp)$' || true)"
[ "${n:-0}" -ge 2 ] && echo "   ✓ inline images: $n" || { echo "   ✗ only ${n:-0} inline image(s) (want ≥2)"; ok=0; }

# 4) answer-first + CTA + internal-link conventions (warn only)
echo "-- conventions --"
grep -q '^\*\*結論：' "$MD" || echo "   ⚠ 本文が「**結論：…**」で始まっていない"
grep -q '(/studio)'   "$MD" || echo "   ⚠ /studio への CTA リンクがない"
grep -q '(/blog/'     "$MD" || echo "   ⚠ 関連記事への内部リンクがない"

echo "----"
if [ "$ok" = 1 ]; then echo "✅ self-check passed — OK to zip"; exit 0
else echo "❌ fix the ✗ items above before zipping"; exit 1; fi
