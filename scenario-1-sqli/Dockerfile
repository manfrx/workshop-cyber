# =====================================================================
#  Cenário 1 · MedClinic — Portal do Paciente
#  (SQL Injection)
#
#  ATENÇÃO: o código do portal (app/) ainda NÃO está neste repositório.
#  Ver app/README.md. O seed em ../seed está completo e verificado.
# =====================================================================
FROM node:20-slim

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

EXPOSE 3000
CMD ["node", "server.js"]
