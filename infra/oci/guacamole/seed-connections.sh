#!/usr/bin/env bash
# Cadastra uma conexão RDP no Guacamole para cada VM de participante.
# Roda NA VM de gerenciamento (ou de qualquer host que alcance o Guacamole).
#
# Uso:  ./seed-connections.sh <ips_file>
#   ips_file = um IP privado por linha (participantes). O up.sh gera isso.
#
# Variáveis de ambiente (com defaults):
#   GUAC_URL   (http://localhost:8080/guacamole)
#   GUAC_ADMIN (guacadmin)        GUAC_PASS (guacadmin)
#   RDP_USER   (aluno)            RDP_PASS  (Workshop@2024)
set -euo pipefail

IPS_FILE="${1:?uso: seed-connections.sh <ips_file>}"
GUAC_URL="${GUAC_URL:-http://localhost:8080/guacamole}"
GUAC_ADMIN="${GUAC_ADMIN:-guacadmin}"
GUAC_PASS="${GUAC_PASS:-guacadmin}"
RDP_USER="${RDP_USER:-aluno}"
# Placeholder CHANGE_ME_* do config.env.example = "nao definido" -> usa a senha
# documentada do lab (a mesma que aparece nos guias do workshop).
case "${RDP_PASS:-}" in CHANGE_ME_*) RDP_PASS="" ;; esac
if [ -z "${RDP_PASS:-}" ]; then
  echo "aviso: usando a senha RDP padrao do lab; defina RDP_PASS no config.env" >&2
  RDP_PASS="Workshop@2024"
fi

need() { command -v "$1" >/dev/null || { echo "faltando: $1" >&2; exit 1; }; }
need curl; need jq

# 1) autentica e pega o token + datasource
resp="$(curl -s "$GUAC_URL/api/tokens" \
  --data-urlencode "username=$GUAC_ADMIN" \
  --data-urlencode "password=$GUAC_PASS")"
TOKEN="$(echo "$resp" | jq -r '.authToken')"
DS="$(echo "$resp" | jq -r '.dataSource')"
[ -n "$TOKEN" ] && [ "$TOKEN" != "null" ] || { echo "login no Guacamole falhou (troque a senha padrão?)"; exit 1; }
echo "autenticado no Guacamole (datasource=$DS)"

# conexões já existentes (idempotência)
EXISTING="$(curl -s "$GUAC_URL/api/session/data/$DS/connections?token=$TOKEN" | jq -r '.[].name' 2>/dev/null)"

# 2) uma conexão RDP por IP
i=0
while IFS= read -r ip; do
  [ -n "$ip" ] || continue
  i=$((i+1))
  name="$(printf 'VM-%02d (%s)' "$i" "$ip")"
  if printf '%s\n' "$EXISTING" | grep -qxF "$name"; then
    echo "  [--] $name (já existe, pulando)"; continue
  fi
  body="$(jq -n --arg name "$name" --arg host "$ip" --arg u "$RDP_USER" --arg p "$RDP_PASS" '{
    parentIdentifier:"ROOT", name:$name, protocol:"rdp",
    parameters:{ hostname:$host, port:"3389", username:$u, password:$p,
                 "ignore-cert":"true", security:"any", "resize-method":"display-update" },
    attributes:{}
  }')"
  code="$(curl -s -o /dev/null -w '%{http_code}' \
    -X POST "$GUAC_URL/api/session/data/$DS/connections?token=$TOKEN" \
    -H 'Content-Type: application/json' -d "$body")"
  echo "  [$code] $name"
done < "$IPS_FILE"

echo "pronto: $i conexão(ões) cadastrada(s)."
echo "Acesse $GUAC_URL e entre com $GUAC_ADMIN (troque a senha!)."
