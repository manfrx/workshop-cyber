# =====================================================================
#  Cenário 3 · Webmail de treinamento
#  (caixa de e-mail ficticia com a quest de phishing)
# =====================================================================
FROM node:20-alpine

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./

EXPOSE 3000
CMD ["node", "server.js"]
