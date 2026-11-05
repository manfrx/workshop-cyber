# ============================================================================
# lib.sh — helpers compartilhados (sourced por up.sh e down.sh). Não executar.
# ============================================================================
set -euo pipefail

OCI_BIN="${OCI_BIN:-$HOME/.local/bin/oci}"
[ -x "$OCI_BIN" ] || OCI_BIN="$(command -v oci || true)"
export SUPPRESS_LABEL_WARNING=True

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
STATE_DIR="$HERE/.state"
mkdir -p "$STATE_DIR"

# --- logging ---
c_blue='\033[0;34m'; c_grn='\033[0;32m'; c_yel='\033[0;33m'; c_red='\033[0;31m'; c_off='\033[0m'
log()  { printf "${c_blue}▶ %s${c_off}\n" "$*"; }
ok()   { printf "${c_grn}✓ %s${c_off}\n" "$*"; }
warn() { printf "${c_yel}! %s${c_off}\n" "$*"; }
die()  { printf "${c_red}✗ %s${c_off}\n" "$*" >&2; exit 1; }

# --- wrapper do oci ---
oci() { "$OCI_BIN" "$@"; }

# resolve o compartimento (tenancy se vazio)
resolve_compartment() {
  if [ -n "${COMPARTMENT_OCID:-}" ]; then echo "$COMPARTMENT_OCID"; return; fi
  awk -F= '/^tenancy=/{print $2}' "$HOME/.oci/config"
}

# JMESPath helper: tag de freeform como argumento JSON para create
freeform_tag_json() { printf '{"%s":"%s"}' "$TAG_KEY" "$TAG_VALUE"; }

# espera um recurso atingir um lifecycle-state
# uso: wait_state <get-cmd...> -- <estado-alvo>
wait_lifecycle() {
  local target="$1"; shift
  local id="$1"; shift
  local kind="$1"; shift   # ex: instance, vcn, subnet
  local tries=60
  while [ $tries -gt 0 ]; do
    local st
    st="$(oci "$kind" get --"${kind}-id" "$id" --query 'data."lifecycle-state"' --raw-output 2>/dev/null || true)"
    [ "$st" = "$target" ] && return 0
    case "$st" in TERMINATED|FAILED) die "$kind $id entrou em estado $st";; esac
    sleep 5; tries=$((tries-1))
  done
  die "timeout aguardando $kind $id ficar $target"
}

# busca o 1º OCID de um recurso por display-name + tag (idempotência)
find_by_name() {
  local kind="$1" name="$2" extra="${3:-}"
  # shellcheck disable=SC2086
  oci $kind list --compartment-id "$COMP" $extra \
    --query "data[?\"display-name\"=='$name'] | [0].id" --raw-output 2>/dev/null \
    | grep -v '^None$' || true
}
