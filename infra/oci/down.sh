#!/usr/bin/env bash
# ============================================================================
# down.sh — derruba TODA a infra marcada com a tag do config.env:
#   termina as instâncias e apaga subnets, security lists, route tables,
#   gateways e a VCN. Ação destrutiva e irreversível.
#   ./down.sh        pede confirmação
#   ./down.sh -y     não pergunta
# ============================================================================
HERE="$(cd "$(dirname "$0")" && pwd)"
source "$HERE/config.env"
source "$HERE/lib.sh"
COMP="$(resolve_compartment)"

YES=0; [ "${1:-}" = "-y" ] && YES=1

# filtra OCIDs por freeform-tag[TAG_KEY]==TAG_VALUE usando jq
tagged() { # <lista json completa> -> ids
  jq -r --arg k "$TAG_KEY" --arg v "$TAG_VALUE" \
    '.data[]? | select(."freeform-tags"[$k] == $v) | .id'
}

log "Procurando recursos com $TAG_KEY=$TAG_VALUE em $REGION…"
INSTS="$(oci compute instance list --compartment-id "$COMP" --all 2>/dev/null \
  | tagged | { grep -v '^$' || true; })"
VCNS="$(oci network vcn list --compartment-id "$COMP" --all 2>/dev/null | tagged || true)"

n_inst=$(printf '%s\n' "$INSTS" | grep -c . || true)
echo "  instâncias: $n_inst | VCNs: $(printf '%s\n' "$VCNS" | grep -c . || true)"
[ "$n_inst" = "0" ] && [ -z "$VCNS" ] && { ok "Nada para remover."; exit 0; }

if [ "$YES" -eq 0 ]; then
  printf "${c_red}Apagar TODOS esses recursos? Isto é irreversível. [digite 'sim']: ${c_off}"
  read -r ans; [ "$ans" = "sim" ] || { warn "cancelado."; exit 1; }
fi

# 1) terminar instâncias
for id in $INSTS; do
  log "Terminando instância $id"
  oci compute instance terminate --instance-id "$id" --preserve-boot-volume false --force >/dev/null 2>&1 || true
done
for id in $INSTS; do
  oci compute instance get --instance-id "$id" --wait-for-state TERMINATED --max-wait-seconds 600 >/dev/null 2>&1 || true
done
ok "Instâncias terminadas."

# 2) para cada VCN marcada, apagar filhos e depois a VCN
for vcn in $VCNS; do
  log "Limpando VCN $vcn"
  for s in $(oci network subnet list --compartment-id "$COMP" --vcn-id "$vcn" --all --query 'data[].id' --raw-output 2>/dev/null); do
    oci network subnet delete --subnet-id "$s" --force >/dev/null 2>&1 || true
  done
  for sl in $(oci network security-list list --compartment-id "$COMP" --vcn-id "$vcn" --all | tagged); do
    oci network security-list delete --security-list-id "$sl" --force >/dev/null 2>&1 || true
  done
  for rt in $(oci network route-table list --compartment-id "$COMP" --vcn-id "$vcn" --all | tagged); do
    oci network route-table delete --rt-id "$rt" --force >/dev/null 2>&1 || true
  done
  for ig in $(oci network internet-gateway list --compartment-id "$COMP" --vcn-id "$vcn" --all --query 'data[].id' --raw-output 2>/dev/null); do
    oci network internet-gateway delete --ig-id "$ig" --force >/dev/null 2>&1 || true
  done
  for nat in $(oci network nat-gateway list --compartment-id "$COMP" --vcn-id "$vcn" --all --query 'data[].id' --raw-output 2>/dev/null); do
    oci network nat-gateway delete --nat-gateway-id "$nat" --force >/dev/null 2>&1 || true
  done
  log "Apagando VCN $vcn"
  oci network vcn delete --vcn-id "$vcn" --force >/dev/null 2>&1 || warn "não consegui apagar a VCN (recursos remanescentes?)"
done

rm -f "$STATE_DIR"/*.id "$STATE_DIR"/*.ips "$STATE_DIR"/*.pubip 2>/dev/null || true
ok "Teardown concluído."
