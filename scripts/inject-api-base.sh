#!/bin/sh
# Build-time substitution for the frontend's API base URL.
# Netlify runs this from the repo root; it overwrites
# frontend/public/js/config.js with a one-liner that pins the API host.
#
# Required env var: KLUSRAAK_API_BASE  (e.g. https://klusraak-api.fly.dev)

set -eu

if [ -z "${KLUSRAAK_API_BASE:-}" ]; then
  echo "build error: KLUSRAAK_API_BASE is not set" >&2
  exit 1
fi

# A timestamp comment makes the file content change every build, so
# Netlify never serves a stale cache layer when the env var swaps.
target="frontend/public/js/config.js"
cat > "$target" <<EOF
// Generated at build time ($(date -u +%Y-%m-%dT%H:%M:%SZ)).
// Source of truth: KLUSRAAK_API_BASE in Netlify site env.
window.KLUSRAAK_API_BASE = "${KLUSRAAK_API_BASE}";
EOF

echo "wrote $target with KLUSRAAK_API_BASE=$KLUSRAAK_API_BASE"
