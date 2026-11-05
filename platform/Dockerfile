# =====================================================================
#  Plataforma do workshop
#  (autenticacao, webmail/quest de phishing, submissão de flags e placar)
# =====================================================================
FROM node:20-alpine

WORKDIR /usr/src/app
COPY app/package.json ./
RUN npm install --omit=dev
COPY app/ ./
RUN mkdir -p /data

EXPOSE 3000
CMD ["node", "server.js"]
