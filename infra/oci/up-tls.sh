#!/usr/bin/env bash
# ============================================================================
# up-tls.sh — igual ao up.sh, porém COM TLS: a mgmt sobe um nginx que termina
# HTTPS (443) na frente da plataforma e do Guacamole, redirecionando 80->443.
#
# Por padrão usa certificado SELF-SIGNED (não depende de domínio nem de CA —
# evita o erro de emissão que você viu). Para Let's Encrypt, preencha DOMAIN e
# LE_EMAIL no config.env e aponte o domínio para o IP público da mgmt antes.
#
#   ./up-tls.sh                 provisiona + configura com TLS
#   ./up-tls.sh --skip-config   só a infra
# ============================================================================
HERE="$(cd "$(dirname "$0")" && pwd)"
ENABLE_TLS=1 exec "$HERE/up.sh" "$@"
