#!/usr/bin/env bash
# Push env vars from .env.local to the linked Vercel project (femisan/wagamori).
# Values are piped via stdin and never printed. Only key names + ok/fail show.
set -euo pipefail
cd "$(dirname "$0")"

# Load .env.local into the environment (values not printed).
set -a; . ./.env.local; set +a

# Secrets/config to copy verbatim from .env.local.
KEYS=(
  OPENAI_API_KEY
  NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  CLERK_SECRET_KEY
  DATABASE_URL
  BLOB_READ_WRITE_TOKEN
  STRIPE_SECRET_KEY
  STRIPE_WEBHOOK_SECRET
  RESEND_API_KEY
  ADMIN_TOKEN
  NEXT_PUBLIC_CLERK_SIGN_IN_URL
  NEXT_PUBLIC_CLERK_SIGN_UP_URL
  NEXT_PUBLIC_CLERK_SIGN_IN_FALLBACK_REDIRECT_URL
  NEXT_PUBLIC_CLERK_SIGN_UP_FALLBACK_REDIRECT_URL
)
ENVS=(production preview)

push() { # name value
  local name="$1" val="$2"
  for e in "${ENVS[@]}"; do
    # remove first so re-running this script overwrites cleanly
    vercel env rm "$name" "$e" -y >/dev/null 2>&1 || true
    if printf '%s' "$val" | vercel env add "$name" "$e" >/dev/null 2>&1; then
      echo "  $name -> $e  ok"
    else
      echo "  $name -> $e  FAIL"
    fi
  done
}

echo "Pushing env vars to $(vercel whoami 2>/dev/null)/wagamori ..."
for k in "${KEYS[@]}"; do
  v="${!k:-}"
  if [ -n "$v" ]; then push "$k" "$v"; else echo "  $k  (missing in .env.local — skipped)"; fi
done

# Production site URL (force, don't use local value)
push NEXT_PUBLIC_SITE_URL "https://wagamori.com"

echo "Done. Still TODO (not in .env.local): CRON_SECRET, EMAIL_FROM"
