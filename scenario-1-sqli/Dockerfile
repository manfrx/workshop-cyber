# =====================================================================
#  Cenário 1 · MedClinic — Portal do Paciente
#  (SQL Injection)
#
#  O seed vive em ../seed e e montado no container do MySQL.
#  O app usa as variaveis DB_HOST / DB_USER / DB_PASSWORD / DB_NAME / PORT.
#  A flag NAO vem por aqui: ela e injetada pelo seed a partir de C1_FLAG.
# =====================================================================
FROM node:20-alpine

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

EXPOSE 3000
CMD ["node", "server.js"]
