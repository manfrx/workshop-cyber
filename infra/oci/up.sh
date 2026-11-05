#!/usr/bin/env bash
# ============================================================================
# up.sh — provisiona a infra do Workshop Cyber na OCI (SEM TLS):
#   VCN + subnets (pública/privada) + gateways + security lists
#   1 VM de gerenciamento (Linux ARM, pública) + N VMs de participante
#   (Windows x86, privadas), com o simulacao.ps1 embarcado e agendado.
# Idempotente: recursos são reaproveitados por display-name. Tudo recebe a tag
# do config.env; use down.sh para derrubar.
#
#   ./up.sh                 provisiona e configura a mgmt (HTTP, sem TLS)
#   ./up.sh --skip-config   só provisiona a infra (não entra via SSH)
#
# Para a versão com TLS use ./up-tls.sh (wrapper que liga ENABLE_TLS).
# ============================================================================
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.env"
source "$HERE/lib.sh"

SKIP_CONFIG=0
[ "${1:-}" = "--skip-config" ] && SKIP_CONFIG=1
ENABLE_TLS="${ENABLE_TLS:-0}"

COMP="$(resolve_compartment)"
[ -n "$COMP" ] || die "não consegui resolver o compartimento (veja ~/.oci/config)"
command -v jq >/dev/null || die "instale o jq (sudo apt-get install -y jq)"
command -v python3 >/dev/null || die "instale o python3"
log "Compartimento: $COMP | Região: $REGION | AD: $AD | TLS: $ENABLE_TLS"

# ---------------------------------------------------------------------------
# preflight: limites (A1 p/ mgmt, E4 p/ participantes)
# ---------------------------------------------------------------------------
avail() { oci limits resource-availability get --compartment-id "$COMP" --service-name compute \
  --limit-name "$1" --availability-domain "$AD" --query 'data.available' --raw-output 2>/dev/null || echo 0; }
NEED_MGMT=$MGMT_OCPU
NEED_PART=$(( PARTICIPANT_COUNT * PARTICIPANT_OCPU ))
MGMT_AV="$(avail "$MGMT_LIMIT")"; PART_AV="$(avail "$PARTICIPANT_LIMIT")"
log "$MGMT_LIMIT (mgmt): preciso $NEED_MGMT, disponível $MGMT_AV | $PARTICIPANT_LIMIT (part.): preciso $NEED_PART, disponível $PART_AV"
{ [ "${MGMT_AV:-0}" -ge "$NEED_MGMT" ] && [ "${PART_AV:-0}" -ge "$NEED_PART" ]; } 2>/dev/null \
  || warn "Limite/capacidade pode ser insuficiente — o launch pode falhar."

# ---------------------------------------------------------------------------
# chave SSH (para a mgmt Linux)
# ---------------------------------------------------------------------------
if [ ! -f "$SSH_KEY" ]; then
  log "Gerando chave SSH em $SSH_KEY"
  mkdir -p "$(dirname "$SSH_KEY")"; ssh-keygen -t rsa -b 2048 -N "" -f "$SSH_KEY" -q
fi
PUBKEY="$SSH_KEY.pub"; ok "Chave SSH: $PUBKEY"

# ---------------------------------------------------------------------------
# imagens (mgmt Linux ARM / participante Windows x86)
# ---------------------------------------------------------------------------
resolve_image() { # <os> <version> <shape>
  oci compute image list --compartment-id "$COMP" --operating-system "$1" \
    --operating-system-version "$2" --shape "$3" --sort-by TIMECREATED --sort-order DESC \
    --query 'data[0].id' --raw-output
}
log "Resolvendo imagens…"
MGMT_IMAGE="$(resolve_image "$MGMT_IMAGE_OS" "$MGMT_IMAGE_OS_VERSION" "$MGMT_SHAPE")"
PART_IMAGE="$(resolve_image "$PARTICIPANT_IMAGE_OS" "$PARTICIPANT_IMAGE_OS_VERSION" "$PARTICIPANT_SHAPE")"
[ -n "$MGMT_IMAGE" ] && [ "$MGMT_IMAGE" != "None" ] || die "imagem mgmt não encontrada"
[ -n "$PART_IMAGE" ] && [ "$PART_IMAGE" != "None" ] || die "imagem Windows não encontrada"
ok "mgmt image:  $MGMT_IMAGE"
ok "win  image:  $PART_IMAGE"

FFTAG="$(freeform_tag_json)"

# ---------------------------------------------------------------------------
# rede (create-if-not-exists por display-name)
# ---------------------------------------------------------------------------
net_find() { local sub="$1" name="$2"; shift 2
  oci network "$sub" list --compartment-id "$COMP" "$@" \
    --query "data[?\"display-name\"=='$name'] | [0].id" --raw-output 2>/dev/null | grep -v '^None$' || true; }

VCN_ID="$(net_find vcn "$PREFIX-vcn")"
[ -z "$VCN_ID" ] && VCN_ID="$(oci network vcn create --compartment-id "$COMP" --display-name "$PREFIX-vcn" \
  --cidr-blocks "[\"$VCN_CIDR\"]" --freeform-tags "$FFTAG" --query 'data.id' --raw-output)"
ok "VCN: $VCN_ID"

IGW_ID="$(net_find internet-gateway "$PREFIX-igw" --vcn-id "$VCN_ID")"
[ -z "$IGW_ID" ] && IGW_ID="$(oci network internet-gateway create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --is-enabled true --display-name "$PREFIX-igw" --freeform-tags "$FFTAG" --query 'data.id' --raw-output)"
NAT_ID="$(net_find nat-gateway "$PREFIX-nat" --vcn-id "$VCN_ID")"
[ -z "$NAT_ID" ] && NAT_ID="$(oci network nat-gateway create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-nat" --freeform-tags "$FFTAG" --query 'data.id' --raw-output)"
ok "Gateways: igw=$IGW_ID nat=$NAT_ID"

RT_PUB="$(net_find route-table "$PREFIX-rt-public" --vcn-id "$VCN_ID")"
[ -z "$RT_PUB" ] && RT_PUB="$(oci network route-table create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-rt-public" --freeform-tags "$FFTAG" \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$IGW_ID\"}]" \
  --query 'data.id' --raw-output)"
RT_PRIV="$(net_find route-table "$PREFIX-rt-private" --vcn-id "$VCN_ID")"
[ -z "$RT_PRIV" ] && RT_PRIV="$(oci network route-table create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-rt-private" --freeform-tags "$FFTAG" \
  --route-rules "[{\"destination\":\"0.0.0.0/0\",\"destinationType\":\"CIDR_BLOCK\",\"networkEntityId\":\"$NAT_ID\"}]" \
  --query 'data.id' --raw-output)"
ok "Route tables: pub=$RT_PUB priv=$RT_PRIV"

pub_rules="$(jq -nc --arg admin "$ADMIN_CIDR" --arg vcn "$VCN_CIDR" '[
  {source:$admin,protocol:"6",isStateless:false,tcpOptions:{destinationPortRange:{min:22,max:22}}},
  {source:"0.0.0.0/0",protocol:"6",isStateless:false,tcpOptions:{destinationPortRange:{min:80,max:80}}},
  {source:"0.0.0.0/0",protocol:"6",isStateless:false,tcpOptions:{destinationPortRange:{min:443,max:443}}},
  {source:"0.0.0.0/0",protocol:"6",isStateless:false,tcpOptions:{destinationPortRange:{min:8080,max:8080}}},
  {source:"0.0.0.0/0",protocol:"6",isStateless:false,tcpOptions:{destinationPortRange:{min:3000,max:3005}}},
  {source:$vcn,protocol:"all",isStateless:false}
]')"
priv_rules="$(jq -nc --arg vcn "$VCN_CIDR" '[{source:$vcn,protocol:"all",isStateless:false}]')"
egress_all='[{"destination":"0.0.0.0/0","destinationType":"CIDR_BLOCK","protocol":"all","isStateless":false}]'

SL_PUB="$(net_find security-list "$PREFIX-sl-public" --vcn-id "$VCN_ID")"
[ -z "$SL_PUB" ] && SL_PUB="$(oci network security-list create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-sl-public" --freeform-tags "$FFTAG" \
  --ingress-security-rules "$pub_rules" --egress-security-rules "$egress_all" --query 'data.id' --raw-output)"
SL_PRIV="$(net_find security-list "$PREFIX-sl-private" --vcn-id "$VCN_ID")"
[ -z "$SL_PRIV" ] && SL_PRIV="$(oci network security-list create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-sl-private" --freeform-tags "$FFTAG" \
  --ingress-security-rules "$priv_rules" --egress-security-rules "$egress_all" --query 'data.id' --raw-output)"
ok "Security lists: pub=$SL_PUB priv=$SL_PRIV (RDP 3389 e sim $SIM_PORT liberados via regra intra-VCN)"

SUB_PUB="$(net_find subnet "$PREFIX-subnet-public" --vcn-id "$VCN_ID")"
[ -z "$SUB_PUB" ] && SUB_PUB="$(oci network subnet create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-subnet-public" --cidr-block "$PUBLIC_SUBNET_CIDR" \
  --route-table-id "$RT_PUB" --security-list-ids "[\"$SL_PUB\"]" --freeform-tags "$FFTAG" --query 'data.id' --raw-output)"
SUB_PRIV="$(net_find subnet "$PREFIX-subnet-private" --vcn-id "$VCN_ID")"
[ -z "$SUB_PRIV" ] && SUB_PRIV="$(oci network subnet create --compartment-id "$COMP" --vcn-id "$VCN_ID" \
  --display-name "$PREFIX-subnet-private" --cidr-block "$PRIVATE_SUBNET_CIDR" \
  --route-table-id "$RT_PRIV" --security-list-ids "[\"$SL_PRIV\"]" --prohibit-public-ip-on-vnic true \
  --freeform-tags "$FFTAG" --query 'data.id' --raw-output)"
ok "Subnets: pub=$SUB_PUB priv=$SUB_PRIV"

# ---------------------------------------------------------------------------
# render do user-data
# ---------------------------------------------------------------------------
CI_DIR="$STATE_DIR/cloud-init"; mkdir -p "$CI_DIR"
cp "$HERE/cloud-init/mgmt.yaml" "$CI_DIR/mgmt.rendered.yaml"

SIM_PATH="$HERE/$SIM_SCRIPT"
[ -f "$SIM_PATH" ] || die "não achei o script da simulação: $SIM_PATH"
gzip -c "$SIM_PATH" | base64 -w0 > "$CI_DIR/sim.gz.b64"
log "simulacao-tela-cheia.ps1 embarcado ($(wc -c < "$SIM_PATH") bytes -> $(wc -c < "$CI_DIR/sim.gz.b64") b64)"

python3 - "$HERE/cloud-init/participant-windows.ps1" "$CI_DIR/participant.rendered.ps1" \
  "$RDP_USER" "$RDP_PASS" "$SIM_PORT" "$CI_DIR/sim.gz.b64" <<'PY'
import sys
tpl = open(sys.argv[1], encoding='utf-8').read()
b64 = open(sys.argv[6]).read().strip()
tpl = (tpl.replace("__RDP_USER__", sys.argv[3])
          .replace("__RDP_PASS__", sys.argv[4])
          .replace("__SIM_PORT__", sys.argv[5])
          .replace("__SIM_GZ_B64__", b64))
open(sys.argv[2], "w", encoding='utf-8', newline='').write(tpl)
PY
WIN_META_BYTES=$(( $(wc -c < "$CI_DIR/participant.rendered.ps1") * 4 / 3 ))
[ "$WIN_META_BYTES" -lt 32000 ] || warn "user-data Windows ~${WIN_META_BYTES}B (limite ~32KB). Considere Object Storage."

# ---------------------------------------------------------------------------
# launch (assíncrono)
# ---------------------------------------------------------------------------
launch() { # <name> <image> <shape> <subnet> <ocpu> <mem> <pubip> <userdata>
  local name="$1" image="$2" shape="$3" subnet="$4" ocpu="$5" mem="$6" pubip="$7" ud="$8"
  local existing; existing="$(oci compute instance list --compartment-id "$COMP" \
    --query "data[?\"display-name\"=='$name' && \"lifecycle-state\"!='TERMINATED'] | [0].id" --raw-output 2>/dev/null | grep -v '^None$' || true)"
  [ -n "$existing" ] && { echo "$existing"; return; }
  oci compute instance launch --compartment-id "$COMP" --availability-domain "$AD" \
    --display-name "$name" --shape "$shape" --shape-config "{\"ocpus\":$ocpu,\"memoryInGBs\":$mem}" \
    --image-id "$image" --subnet-id "$subnet" --assign-public-ip "$pubip" \
    --ssh-authorized-keys-file "$PUBKEY" --user-data-file "$ud" \
    --freeform-tags "$FFTAG" --query 'data.id' --raw-output
}

log "Lançando VM de gerenciamento (Linux ARM)…"
MGMT_ID="$(launch "$PREFIX-mgmt" "$MGMT_IMAGE" "$MGMT_SHAPE" "$SUB_PUB" "$MGMT_OCPU" "$MGMT_MEM_GB" true "$CI_DIR/mgmt.rendered.yaml")"
echo "$MGMT_ID" > "$STATE_DIR/mgmt.id"; ok "mgmt: $MGMT_ID"

log "Lançando $PARTICIPANT_COUNT VMs de participante (Windows)…"
: > "$STATE_DIR/participant.ids"
launch_fail=0
for i in $(seq 1 "$PARTICIPANT_COUNT"); do
  n="$(printf '%s-vm-%02d' "$PREFIX" "$i")"
  if id="$(launch "$n" "$PART_IMAGE" "$PARTICIPANT_SHAPE" "$SUB_PRIV" "$PARTICIPANT_OCPU" "$PARTICIPANT_MEM_GB" false "$CI_DIR/participant.rendered.ps1")" && [ -n "$id" ]; then
    echo "$id" >> "$STATE_DIR/participant.ids"; printf '  %s -> %s\n' "$n" "$id"
  else
    launch_fail=$((launch_fail+1)); warn "falhou ao criar $n (limite diário? capacidade?) — seguindo"
  fi
done
if [ "$launch_fail" -gt 0 ]; then
  warn "$launch_fail VM(s) não criada(s). Configurando as que subiram; rode o up.sh de novo depois (é idempotente) para completar."
else
  ok "Todas as instâncias solicitadas."
fi

# ---------------------------------------------------------------------------
# aguarda RUNNING e coleta IPs
# ---------------------------------------------------------------------------
log "Garantindo instâncias RUNNING (liga as que estiverem paradas)…"
all_ids=("$MGMT_ID"); while IFS= read -r x; do [ -n "$x" ] && all_ids+=("$x"); done < "$STATE_DIR/participant.ids"
for id in "${all_ids[@]}"; do
  st="$(oci compute instance get --instance-id "$id" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || true)"
  case "$st" in
    STOPPED|STOPPING) oci compute instance action --instance-id "$id" --action START >/dev/null 2>&1 || true ;;
  esac
done
for id in "${all_ids[@]}"; do
  oci compute instance get --instance-id "$id" --wait-for-state RUNNING --max-wait-seconds 900 >/dev/null 2>&1 \
    || warn "instância $id não confirmou RUNNING"
done

get_ip() { oci compute instance list-vnics --instance-id "$1" --query "data[0].\"$2-ip\"" --raw-output 2>/dev/null; }
MGMT_PUBIP="$(get_ip "$MGMT_ID" public)"; echo "$MGMT_PUBIP" > "$STATE_DIR/mgmt.pubip"
: > "$STATE_DIR/participant.ips"
while IFS= read -r id; do [ -n "$id" ] || continue; get_ip "$id" private >> "$STATE_DIR/participant.ips"; done < "$STATE_DIR/participant.ids"
ok "mgmt IP público: $MGMT_PUBIP | IPs privados em $STATE_DIR/participant.ips"

# ---------------------------------------------------------------------------
# configura a mgmt (opcional)
# ---------------------------------------------------------------------------
if [ "$SKIP_CONFIG" -eq 0 ]; then
  log "Configurando a VM de gerenciamento via SSH (TLS=$ENABLE_TLS)…"
  MGMT_PUBIP="$MGMT_PUBIP" ENABLE_TLS="$ENABLE_TLS" "$HERE/configure-mgmt.sh" || warn "configure-mgmt falhou — rode manualmente."
fi

SCHEME="http"; WEBPORT=":3005"; GUACPORT=":8080"
[ "$ENABLE_TLS" = "1" ] && { SCHEME="https"; WEBPORT=""; GUACPORT=""; }
cat <<EOF

────────────────────────────────────────────────────────
 Ambiente provisionado (TLS=$ENABLE_TLS).
   mgmt (SSH):    ssh -i $SSH_KEY ubuntu@$MGMT_PUBIP
   Guacamole:     $SCHEME://$MGMT_PUBIP$GUACPORT/guacamole   (guacadmin/guacadmin — troque!)
   Plataforma:    $SCHEME://$MGMT_PUBIP$WEBPORT
   Participantes: $PARTICIPANT_COUNT VMs Windows (RDP via Guacamole; simulacao.ps1 na porta $SIM_PORT)
 Derrubar tudo:   ./down.sh
────────────────────────────────────────────────────────
EOF
