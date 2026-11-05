# =====================================================================
#  Cenário 2 · Meridian Capital — Portal do Investidor
#  (Command Injection)
#
#  A flag NÃO é hardcoded aqui: ela chega via build arg (C2_FLAG),
#  com o valor definido em infra/.env. Ver infra/docker-compose.yml.
# =====================================================================
FROM node:20-slim

# Ferramentas de rede/sistema para a "ferramenta de diagnóstico" (e p/ a demo de RCE)
RUN apt-get update && apt-get install -y --no-install-recommends \
    iputils-ping ca-certificates procps \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

# Flag acessível apenas como root (de propósito para o cenário).
# ARG -> o valor vem de ${C2_FLAG} (infra/.env), nunca do repositório.
ARG C2_FLAG=FLAG{PLACEHOLDER_C2}
RUN echo "$C2_FLAG" > /root/flag.txt \
    && chmod 600 /root/flag.txt

EXPOSE 3000
# Roda como root (padrão da imagem) -> o command injection herda root.
CMD ["node", "server.js"]
