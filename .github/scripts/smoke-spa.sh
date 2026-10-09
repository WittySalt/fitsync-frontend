#!/usr/bin/env bash
# Smoke-test a deployed SPA against the build that was just uploaded.
#
# Usage: smoke-spa.sh <base-url> <dist-dir> [timeout-seconds]
#
# Passes when, within the timeout (default 180 s, to let the CloudFront
# invalidation land):
#   1. <base-url>/ returns 200 and names this build's main bundle,
#   2. that main bundle itself returns 200,
#   3. a deep link (/progress) returns 200 through the SPA fallback and also
#      names this build's main bundle,
#   4. <base-url>/api/v1/health (the gateway, forwarded by CloudFront) returns
#      200 with status UP.
# Read only: it sends GET requests and nothing else.
set -euo pipefail

base="${1:?usage: smoke-spa.sh <base-url> <dist-dir> [timeout-seconds]}"
base="${base%/}"
dir="${2:?usage: smoke-spa.sh <base-url> <dist-dir> [timeout-seconds]}"
timeout="${3:-180}"

main_js="$(grep -oE 'main-[A-Za-z0-9]+\.js' "$dir/index.html" | head -n1 || true)"
[ -n "$main_js" ] || { echo "No main-*.js bundle named in $dir/index.html" >&2; exit 1; }
echo "Expecting $main_js at $base"

fetch() { # url -> prints "<status>" and leaves the body in $body_file
  curl -sS -o "$body_file" -w '%{http_code}' -H 'Cache-Control: no-cache' --max-time 20 "$1" || echo 000
}

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
deadline=$(( $(date +%s) + timeout ))
attempt=0
while :; do
  attempt=$((attempt + 1))
  problem=""
  status="$(fetch "$base/")"
  if [ "$status" != 200 ]; then problem="/ returned $status"
  elif ! grep -q "$main_js" "$body_file"; then problem="/ does not name $main_js yet (older build still cached?)"
  else
    status="$(fetch "$base/$main_js")"
    if [ "$status" != 200 ]; then problem="/$main_js returned $status"
    else
      status="$(fetch "$base/progress")"
      if [ "$status" != 200 ]; then problem="/progress returned $status"
      elif ! grep -q "$main_js" "$body_file"; then problem="/progress does not serve this build's index.html"
      else
        status="$(fetch "$base/api/v1/health")"
        if [ "$status" != 200 ]; then problem="/api/v1/health returned $status"
        elif ! grep -Eq '"status" *: *"UP"' "$body_file"; then problem="/api/v1/health is not UP: $(head -c 200 "$body_file")"
        fi
      fi
    fi
  fi
  if [ -z "$problem" ]; then
    echo "Smoke test passed for $base on attempt $attempt: /, /$main_js, /progress and /api/v1/health."
    exit 0
  fi
  if [ "$(date +%s)" -ge "$deadline" ]; then
    echo "Smoke test failed for $base after $attempt attempts: $problem" >&2
    exit 1
  fi
  echo "Attempt $attempt: $problem; retrying in 10 s."
  sleep 10
done
