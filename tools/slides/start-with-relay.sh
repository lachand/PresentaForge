#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"

HTTP_PORT="${HTTP_PORT:-8080}"
HTTP_BIND="${HTTP_BIND:-0.0.0.0}"
RELAY_PORT="${RELAY_PORT:-8787}"
RELAY_HOST="${RELAY_HOST:-0.0.0.0}"
RELAY_TOKEN="${RELAY_TOKEN:-}"
PUBLIC_HOST="${PUBLIC_HOST:-}"
FORCE_RELAY_LINK="${FORCE_RELAY_LINK:-1}"

pick_public_host() {
  if [[ -n "${PUBLIC_HOST}" ]]; then
    echo "${PUBLIC_HOST}"
    return 0
  fi
  local route_ip
  route_ip="$(ip route get 1.1.1.1 2>/dev/null | awk '{for(i=1;i<=NF;i++) if($i=="src"){print $(i+1); exit}}' || true)"
  if [[ -n "${route_ip}" ]]; then
    echo "${route_ip}"
    return 0
  fi
  local host_ip
  host_ip="$(hostname -I 2>/dev/null | awk '{print $1}' || true)"
  if [[ -n "${host_ip}" ]]; then
    echo "${host_ip}"
    return 0
  fi
  echo "localhost"
}

PUBLIC_HOST="$(pick_public_host)"
RELAY_WS_URL="ws://${PUBLIC_HOST}:${RELAY_PORT}"
VIEWER_URL="http://${PUBLIC_HOST}:${HTTP_PORT}/slides/viewer.html?mode=presenter&relayWs=${RELAY_WS_URL}"
if [[ -n "${RELAY_TOKEN}" ]]; then
  VIEWER_URL="${VIEWER_URL}&relayToken=${RELAY_TOKEN}"
fi
if [[ "${FORCE_RELAY_LINK}" == "1" ]]; then
  VIEWER_URL="${VIEWER_URL}&transport=relay"
fi

echo "== PresentaForge relay kit =="
echo "HTTP   : http://${PUBLIC_HOST}:${HTTP_PORT} (bind ${HTTP_BIND})"
echo "Relay  : ${RELAY_WS_URL} (bind ${RELAY_HOST})"
if [[ -n "${RELAY_TOKEN}" ]]; then
  echo "Token  : actif"
else
  echo "Token  : inactif"
fi
echo
echo "Ouvre le mode presentateur avec relay configure :"
echo "  ${VIEWER_URL}"
echo
echo "Dans la salle > Diagnostic reseau:"
echo "  1) Verifie l'etat 'P2P + relay' ou 'relay pret'"
echo "  2) Partage 'Copier lien relay' si des etudiants sont bloques"
echo

cleanup() {
  if [[ -n "${RELAY_PID:-}" ]]; then
    kill "${RELAY_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT INT TERM

(
  cd "${ROOT_DIR}"
  RELAY_PORT="${RELAY_PORT}" RELAY_HOST="${RELAY_HOST}" RELAY_TOKEN="${RELAY_TOKEN}" node tools/slides/relay-server.mjs
) &
RELAY_PID=$!

cd "${ROOT_DIR}"
python3 -m http.server "${HTTP_PORT}" --bind "${HTTP_BIND}"
