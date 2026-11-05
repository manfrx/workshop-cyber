# =====================================================================
#  Cenário 3 · Controle da simulação de phishing
#  (painel do instrutor, página de isca e overlay de bloqueio)
#
#  Serve a página-isca e dispara /hack e /voltar nas VMs de participante.
# =====================================================================
FROM node:20-alpine

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

EXPOSE 3000
CMD ["node", "server.js"]
