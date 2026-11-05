#!/usr/bin/env bash
# ============================================================================
# configure-mgmt.sh — envia o código para a VM de gerenciamento e sobe:
#   challenges 1/2, plataforma, Guacamole e (se ENABLE_TLS=1) nginx com TLS.
#   Também cadastra as conexões RDP das VMs Windows no Guacamole.
# Chamado pelo up.sh/up-tls.sh, mas reexecutável:
#   MGMT_PUBIP=<ip> ENABLE_TLS=0|1 ./configure-mgmt.sh
# ============================================================================
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.env"
source "$HERE/lib.sh"
REPO="$(cd "$HERE/.." && pwd)"
ENABLE_TLS="${ENABLE_TLS:-0}"

# Placeholders CHANGE_ME_* do config.env.example contam como "nao definido",
# assim o default documentado do lab continua valendo ate voce definir a senha.
case "${RDP_PASS:-}"   in CHANGE_ME_*) RDP_PASS=""   ;; esac
case "${ADMIN_PASS:-}" in CHANGE_ME_*) ADMIN_PASS="" ;; esac

MGMT_PUBIP="${MGMT_PUBIP:-}"
[ -n "$MGMT_PUBIP" ] || MGMT_PUBIP="$(cat "$STATE_DIR/mgmt.pubip" 2>/dev/null || true)"
[ -n "$MGMT_PUBIP" ] || die "defina MGMT_PUBIP=<ip> (ou rode o up.sh antes)"

# senha do admin do Guacamole: config -> .state -> gera (nunca fica a padrão)
GUAC_ADMIN_PASS="${GUAC_ADMIN_PASS:-}"
[ -n "$GUAC_ADMIN_PASS" ] || GUAC_ADMIN_PASS="$(cat "$STATE_DIR/guacadmin.pass" 2>/dev/null || true)"
[ -n "$GUAC_ADMIN_PASS" ] || GUAC_ADMIN_PASS="Guac-$(openssl rand -base64 9 | tr -d '/+=' | cut -c1-12)!"
echo "$GUAC_ADMIN_PASS" > "$STATE_DIR/guacadmin.pass"; chmod 600 "$STATE_DIR/guacadmin.pass"

# URL da isca: se vazio, aponta para a mgmt pelo IP PRIVADO — o fluxo acontece
# dentro da VM Windows (o bloqueio.js chama 127.0.0.1:10000 = a própria vítima),
# e a VM privada alcança a mgmt pelo IP interno (não pelo público, que faz hairpin
# no NAT). Para vítima externa, preencha PHISHING_URL no config.env com o público.
if [ -z "${PHISHING_URL:-}" ]; then
  MGMT_PRIVIP="$(oci compute instance list-vnics --instance-id "$(cat "$STATE_DIR/mgmt.id" 2>/dev/null)" --query 'data[0]."private-ip"' --raw-output 2>/dev/null || true)"
  HOST="${MGMT_PRIVIP:-$MGMT_PUBIP}"
  # A isca (documento) fica sempre em HTTP puro na porta 80 — a página HTTP
  # consegue chamar http://127.0.0.1:10000/hack sem bloqueio de mixed-content.
  PHISHING_URL="http://$HOST/documento"
fi
log "PHISHING_URL = $PHISHING_URL"

SSH="ssh -i $SSH_KEY -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null"
REMOTE="ubuntu@$MGMT_PUBIP"

log "Aguardando SSH em $MGMT_PUBIP…"
for _ in $(seq 1 60); do $SSH -o ConnectTimeout=5 "$REMOTE" true 2>/dev/null && break || sleep 5; done
log "Aguardando cloud-init concluir…"
$SSH "$REMOTE" 'cloud-init status --wait' 2>/dev/null || warn "cloud-init status indisponível, seguindo"

log "Enviando código para /opt/workshop…"
if command -v rsync >/dev/null; then
  rsync -az --delete -e "$SSH" --exclude '.git' --exclude 'infra-oci/.state' --exclude '**/db.json' \
    "$REPO/challenge1-sqli" "$REPO/challenge2-cmdi" "$REPO/challenge3-phishing" \
    "$REPO/platform" "$REPO/infra-oci/guacamole" "$REPO/infra-oci/nginx" "$REMOTE:/opt/workshop/"
else
  tar -C "$REPO" --exclude '.git' --exclude 'infra-oci/.state' -czf - \
    challenge1-sqli challenge2-cmdi challenge3-phishing platform infra-oci/guacamole infra-oci/nginx \
    | $SSH "$REMOTE" 'mkdir -p /opt/workshop && tar --strip-components=0 -C /opt/workshop -xzf -'
  # normaliza paths infra-oci/* -> topo
  $SSH "$REMOTE" 'cd /opt/workshop && [ -d infra-oci ] && cp -r infra-oci/* . 2>/dev/null; true'
fi
scp -i "$SSH_KEY" -o StrictHostKeyChecking=no -o UserKnownHostsFile=/dev/null \
  "$STATE_DIR/participant.ips" "$REMOTE:/opt/workshop/participant.ips" 2>/dev/null || true

log "Subindo containers na mgmt (TLS=$ENABLE_TLS)…"
$SSH "$REMOTE" \
  ENABLE_TLS="$ENABLE_TLS" DOMAIN="$DOMAIN" LE_EMAIL="$LE_EMAIL" CERT_CN="$MGMT_PUBIP" \
  RDP_USER="$RDP_USER" RDP_PASS="$RDP_PASS" \
  SIM_PORT="${SIM_PORT:-10000}" ADMIN_USER="${ADMIN_USER:-admin}" ADMIN_PASS="${ADMIN_PASS:-Cyber@2022}" \
  PHISHING_URL="$PHISHING_URL" GUAC_ADMIN_PASS="$GUAC_ADMIN_PASS" bash -s <<'REMOTE_EOF'
set -e
cd /opt/workshop
export PHISHING_URL   # usado pela plataforma (docker-compose)
D() { sudo docker "$@"; }

# mgmt ARM: habilita emulação amd64 (binfmt) p/ as imagens do Guacamole
if [ "$(uname -m)" = "aarch64" ]; then
  echo "[guac] mgmt ARM -> instalando emulação amd64 (binfmt)"
  D run --privileged --rm tonistiigi/binfmt --install amd64 || true
fi

# Guacamole: schema do Postgres na 1ª vez
if [ ! -f guacamole/initdb.sql ]; then
  D run --rm --platform linux/amd64 guacamole/guacamole:1.5.5 /opt/guacamole/bin/initdb.sh --postgresql > guacamole/initdb.sql
fi

# Config da plataforma via .env (o compose lê sozinho; à prova de sudo):
# PHISHING_URL, login do painel e IPs das VMs p/ o broadcast de /hack e /voltar.
PART_CSV="$(paste -sd, participant.ips 2>/dev/null || true)"
{
  echo "PHISHING_URL=$PHISHING_URL"
  echo "ADMIN_USER=${ADMIN_USER:-admin}"
  echo "ADMIN_PASS=${ADMIN_PASS:-Cyber@2022}"
  echo "SIM_PORT=${SIM_PORT:-10000}"
  echo "PARTICIPANT_IPS=$PART_CSV"
} > platform/.env
echo "[platform] .env: $(grep -c . platform/.env) var(s); VMs no broadcast: $(echo "$PART_CSV" | tr ',' '\n' | grep -c .)"

# sobe cenários + control (cenário 3) + plataforma + guacamole
for d in challenge1-sqli challenge2-cmdi challenge3-phishing/control platform guacamole; do
  [ -f "$d/docker-compose.yml" ] && (cd "$d" && D compose up -d --build) || true
done

# espera o Guacamole subir
sleep 25

# descobre com qual senha o guacadmin loga hoje (desejada ou padrão)
GUAC="http://localhost:8080/guacamole"
CURPASS=""
for try in "$GUAC_ADMIN_PASS" "guacadmin"; do
  t=$(curl -s "$GUAC/api/tokens" --data-urlencode "username=guacadmin" --data-urlencode "password=$try" | jq -r '.authToken' 2>/dev/null)
  [ -n "$t" ] && [ "$t" != "null" ] && { CURPASS="$try"; break; }
done

# cadastra as conexões RDP (idempotente) usando a senha atual
if [ -n "$CURPASS" ] && [ -f participant.ips ] && [ -f guacamole/seed-connections.sh ]; then
  chmod +x guacamole/seed-connections.sh
  GUAC_PASS="$CURPASS" RDP_USER="$RDP_USER" RDP_PASS="$RDP_PASS" \
    guacamole/seed-connections.sh participant.ips || true
fi

# garante que a senha do admin NÃO é a padrão
if [ "$CURPASS" = "guacadmin" ] && [ "$GUAC_ADMIN_PASS" != "guacadmin" ]; then
  tok=$(curl -s "$GUAC/api/tokens" --data-urlencode "username=guacadmin" --data-urlencode "password=guacadmin")
  T=$(echo "$tok" | jq -r '.authToken'); DS=$(echo "$tok" | jq -r '.dataSource')
  curl -s -o /dev/null -X PUT "$GUAC/api/session/data/$DS/users/guacadmin/password?token=$T" \
    -H 'Content-Type: application/json' \
    -d "{\"oldPassword\":\"guacadmin\",\"newPassword\":\"$GUAC_ADMIN_PASS\"}" \
    && echo "[guac] senha do admin trocada (não é mais a padrão)"
fi

# TLS (nginx) — opcional
if [ "${ENABLE_TLS:-0}" = "1" ]; then
  cd /opt/workshop/nginx
  mkdir -p certs
  if [ -n "$DOMAIN" ] && [ -n "$LE_EMAIL" ]; then
    echo "[nginx] tentando Let's Encrypt para $DOMAIN…"
    D run --rm -p 80:80 -v /opt/workshop/nginx/le:/etc/letsencrypt certbot/certbot \
      certonly --standalone -d "$DOMAIN" -m "$LE_EMAIL" --agree-tos -n || true
    if [ -f "/opt/workshop/nginx/le/live/$DOMAIN/fullchain.pem" ]; then
      sudo cp "/opt/workshop/nginx/le/live/$DOMAIN/fullchain.pem" certs/fullchain.pem
      sudo cp "/opt/workshop/nginx/le/live/$DOMAIN/privkey.pem"   certs/privkey.pem
    fi
  fi
  if [ ! -f certs/fullchain.pem ]; then
    echo "[nginx] gerando certificado self-signed (CN=${DOMAIN:-$CERT_CN})"
    openssl req -x509 -newkey rsa:2048 -nodes -days 365 \
      -keyout certs/privkey.pem -out certs/fullchain.pem -subj "/CN=${DOMAIN:-$CERT_CN}"
  fi
  D compose up -d
  # conf é bind-mount: recarrega p/ aplicar mudanças (ex.: novas portas TLS dos challenges)
  D exec wk-nginx nginx -t 2>/dev/null && D exec wk-nginx nginx -s reload 2>/dev/null \
    && echo "[nginx] conf recarregada" || D restart wk-nginx
  echo "[nginx] TLS no ar em https://${DOMAIN:-$CERT_CN}/ (c1:3000 c2:3001 c3:3003)"
fi
REMOTE_EOF

ok "mgmt configurada."
