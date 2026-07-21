#!/usr/bin/env bash
# Multi-round HTTP audit for peccsupporttool.com and legacy domain redirects.
set -uo pipefail

PRIMARY="https://peccsupporttool.com"
LEGACY="https://impacts-tau.vercel.app"
WWW="https://www.peccsupporttool.com"

ROUTES=(
  "/"
  "/app"
  "/login"
  "/register"
  "/invite/audit-test"
  "/dashboard"
  "/snapshot"
  "/simulation"
  "/milestones"
  "/activities"
  "/prs"
  "/gap-plan"
  "/education"
  "/cohorts"
  "/programs"
  "/mentor/dashboard"
  "/mentor/activities"
  "/mentor/hospitals"
  "/mentor/milestones"
  "/mentor/wages"
  "/mentor/overview"
  "/mentor/reports"
  "/mentor/snapshot"
  "/mentor/cohorts"
  "/mentor/programs"
  "/manager/snapshot"
  "/manager/reports"
  "/manager/overview"
  "/manager/dashboard"
  "/manager/mentors"
  "/manager/activities"
  "/manager/hospitals"
  "/manager/milestones"
  "/manager/crm"
  "/manager/wages"
  "/manager/cohorts"
  "/manager/programs"
  "/manager/permissions"
  "/admin/dashboard"
  "/admin/crm"
  "/admin/users"
  "/admin/settings"
  "/admin/reports"
  "/admin/snapshot"
  "/admin/cohorts"
  "/admin/programs"
  "/hospital-system/dashboard"
  "/hiring-group/snapshot"
  "/account"
  "/admin/crm?tab=team"
  "/admin/settings?tab=programs"
  "/login?registered=success"
  "/this-route-should-404-audit"
)

ROUNDS="${1:-20}"
FAILURES=0
TOTAL_CHECKS=0
WWW_AVAILABLE=""

log_fail() {
  echo "FAIL: $*"
  FAILURES=$((FAILURES + 1))
}

probe_www() {
  if [[ -n "$WWW_AVAILABLE" ]]; then
    return
  fi
  local code
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${WWW}/" 2>/dev/null || echo "000")
  if [[ "$code" == "301" || "$code" == "307" || "$code" == "308" ]]; then
    WWW_AVAILABLE="yes"
  else
    WWW_AVAILABLE="no"
  fi
}

check_primary() {
  local path="$1"
  local url="${PRIMARY}${path}"
  local code ctype
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 25 "$url" 2>/dev/null || echo "000")
  ctype=$(curl -sS -I --max-time 25 "$url" 2>/dev/null | awk -F': ' 'tolower($1)=="content-type"{print tolower($2)}' | tr -d '\r' | head -1)
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  if [[ "$code" != "200" ]]; then
    log_fail "primary path=$path expected 200 got $code"
    return
  fi
  if [[ "$ctype" != *"text/html"* ]]; then
    log_fail "primary path=$path expected html got ${ctype:-unknown}"
  fi
}

check_legacy_redirect() {
  local path="$1"
  local url="${LEGACY}${path}"
  local headers code location
  headers=$(curl -sS -I --max-time 25 "$url" 2>/dev/null || true)
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  code=$(echo "$headers" | awk 'toupper($1) ~ /^HTTP/{code=$2} END{print code+0}')
  location=$(echo "$headers" | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r' | tail -1)
  if [[ "$code" != "308" && "$code" != "301" && "$code" != "307" ]]; then
    log_fail "legacy path=$path expected redirect got $code"
    return
  fi
  local expected="${PRIMARY}${path}"
  if [[ "$location" != "$expected" ]]; then
    log_fail "legacy path=$path location=$location expected=$expected"
  fi
}

check_www_redirect() {
  probe_www
  [[ "$WWW_AVAILABLE" == "yes" ]] || return 0
  local path="$1"
  local url="${WWW}${path}"
  local headers code location
  headers=$(curl -sS -I --max-time 15 "$url" 2>/dev/null || true)
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  code=$(echo "$headers" | awk 'toupper($1) ~ /^HTTP/{code=$2} END{print code+0}')
  location=$(echo "$headers" | awk -F': ' 'tolower($1)=="location"{print $2}' | tr -d '\r' | tail -1)
  if [[ "$code" != "308" && "$code" != "301" && "$code" != "307" ]]; then
    log_fail "www path=$path expected redirect got $code"
    return
  fi
  local expected="${PRIMARY}${path}"
  if [[ "$location" != "$expected" ]]; then
    log_fail "www path=$path location=$location expected=$expected"
  fi
}

check_security_headers() {
  local headers
  headers=$(curl -sS -I --max-time 20 "${PRIMARY}/login" 2>/dev/null || true)
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  for h in "x-content-type-options: nosniff" "x-frame-options: deny" "content-security-policy:"; do
    if ! echo "$headers" | grep -qi "$h"; then
      log_fail "missing header $h on /login"
    fi
  done
}

check_static_asset() {
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  local index_html js_chunk code
  index_html=$(curl -sS --max-time 20 "${PRIMARY}/" 2>/dev/null || true)
  js_chunk=$(echo "$index_html" | grep -oE '/static/js/[^"]+\.js' | head -1)
  if [[ -z "$js_chunk" ]]; then
    log_fail "no js chunk in index.html"
    return
  fi
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 20 "${PRIMARY}${js_chunk}" 2>/dev/null || echo "000")
  if [[ "$code" != "200" ]]; then
    log_fail "static asset $js_chunk got $code"
  fi
}

echo "=== Domain audit: $ROUNDS rounds, ${#ROUTES[@]} routes ==="
for ((round=1; round<=ROUNDS; round++)); do
  echo "--- Round $round/$ROUNDS ---"
  for path in "${ROUTES[@]}"; do
    check_primary "$path"
    if [[ "$path" != *"?"* ]]; then
      check_legacy_redirect "$path"
      check_www_redirect "$path"
    fi
  done
  TOTAL_CHECKS=$((TOTAL_CHECKS + 1))
  check_legacy_redirect "/login?registered=success&message=audit"
  if [[ "$round" -eq 1 || $((round % 5)) -eq 0 ]]; then
    check_security_headers
    check_static_asset
  fi
done

echo ""
echo "=== Summary ==="
echo "Rounds: $ROUNDS"
echo "Routes: ${#ROUTES[@]}"
echo "WWW redirects: ${WWW_AVAILABLE:-not probed}"
echo "Total checks: $TOTAL_CHECKS"
echo "Failures: $FAILURES"
if [[ "$FAILURES" -eq 0 ]]; then
  echo "RESULT: PASS (100%)"
  exit 0
else
  echo "RESULT: FAIL"
  exit 1
fi
