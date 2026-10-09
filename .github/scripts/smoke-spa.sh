#!/usr/bin/env bash
# Smoke-test a deployed SPA against the build that was just uploaded.
#
# Usage: smoke-spa.sh <gate|warn> <base-url> <dist-dir> [timeout-seconds]
#
# Checks, each retried until it passes or the timeout (default 180 s, to let the
# CloudFront invalidation land) runs out:
#   core      1. <base-url>/ returns 200 and names this build's main-*.js,
#             2. that main bundle itself returns 200;
#   fallback  3. the deep link /progress returns 200 through the SPA fallback and
#                also names this build's main bundle;
#   health    4. <base-url>/api/v1/health (the gateway, forwarded by CloudFront)
#                returns 200 with status UP.
#
# Modes:
#   gate  The core checks block: if they still fail at the timeout the script
#         exits 1. The fallback and health checks only warn.
#   warn  Every check only warns.
# A warning is printed as a ::warning:: annotation and listed under a ⚠️ line in
# $GITHUB_STEP_SUMMARY (when set); the script still exits 0.
# Read only: it sends GET requests and nothing else.
set -euo pipefail

usage="usage: smoke-spa.sh <gate|warn> <base-url> <dist-dir> [timeout-seconds]"
mode="${1:?$usage}"
case "$mode" in gate|warn) ;; *) echo "$usage" >&2; exit 2 ;; esac
base="${2:?$usage}"
base="${base%/}"
dir="${3:?$usage}"
timeout="${4:-180}"

main_js="$(grep -oE 'main-[A-Za-z0-9]+\.js' "$dir/index.html" | head -n1 || true)"
[ -n "$main_js" ] || { echo "No main-*.js bundle named in $dir/index.html" >&2; exit 1; }
echo "Smoke test ($mode) of $base, expecting $main_js"

body_file="$(mktemp)"
trap 'rm -f "$body_file"' EXIT
deadline=$(( $(date +%s) + timeout ))

fetch() { # url -> prints the HTTP status and leaves the body in $body_file
  curl -sS -o "$body_file" -w '%{http_code}' -H 'Cache-Control: no-cache' --max-time 20 "$1" || echo 000
}

# Each check prints nothing when it passes, or the problem when it fails.
check_core() {
  local status
  status="$(fetch "$base/")"
  if [ "$status" != 200 ]; then echo "/ returned $status"; return; fi
  if ! grep -q "$main_js" "$body_file"; then echo "/ does not name $main_js (older build still cached?)"; return; fi
  status="$(fetch "$base/$main_js")"
  if [ "$status" != 200 ]; then echo "/$main_js returned $status"; fi
}

check_fallback() {
  local status
  status="$(fetch "$base/progress")"
  if [ "$status" != 200 ]; then echo "/progress returned $status"; return; fi
  if ! grep -q "$main_js" "$body_file"; then echo "/progress does not serve this build's index.html"; fi
}

check_health() {
  local status
  status="$(fetch "$base/api/v1/health")"
  if [ "$status" != 200 ]; then echo "/api/v1/health returned $status"; return; fi
  if ! grep -Eq '"status" *: *"UP"' "$body_file"; then
    echo "/api/v1/health is not UP: $(head -c 200 "$body_file" | tr -d '\r\n')"
  fi
}

# run_check <name> <function>: retries until the check passes or the deadline
# passes (always at least one attempt). Leaves the last problem in $problem.
run_check() {
  local name="$1" fn="$2" attempt=0
  while :; do
    attempt=$((attempt + 1))
    problem="$("$fn")"
    if [ -z "$problem" ]; then echo "PASS $name (attempt $attempt)"; return 0; fi
    if [ "$(date +%s)" -ge "$deadline" ]; then echo "FAIL $name after $attempt attempts: $problem"; return 1; fi
    echo "     $name attempt $attempt: $problem; retrying in 10 s."
    sleep 10
  done
}

warnings=()
warn() {
  echo "::warning title=Smoke test ($base)::$1"
  warnings+=("$1")
}

problem=""
if ! run_check core check_core; then
  if [ "$mode" = gate ]; then
    echo "::error title=Smoke test ($base)::$problem"
    echo "Smoke test failed for $base: the site does not serve this build." >&2
    exit 1
  fi
  warn "$problem"
fi
run_check fallback check_fallback || warn "$problem"
run_check health check_health || warn "$problem"

if [ "${#warnings[@]}" -eq 0 ]; then
  echo "Smoke test passed for $base: /, /$main_js, /progress and /api/v1/health."
  exit 0
fi

echo "Smoke test for $base finished with ${#warnings[@]} warning(s); not failing the job."
if [ -n "${GITHUB_STEP_SUMMARY:-}" ]; then
  {
    echo "⚠️ Smoke test warnings for $base (the job stays green):"
    echo ""
    for w in "${warnings[@]}"; do echo "- $w"; done
    echo ""
  } >> "$GITHUB_STEP_SUMMARY"
fi
exit 0
