# Spurensuche: ein Container mit Node.js 24, ohne weitere Pakete. Daten in /daten (Volume).
FROM node:24-alpine
WORKDIR /srv/spurensuche
# alles außer dem, was .dockerignore ausschließt (Tests, Nachweise, Medien, Git); fehlende Inhaltsordner sind erlaubt
COPY --chown=node:node . .
RUN mkdir -p /daten && chown node:node /daten
USER node
ENV NODE_ENV=production SPUR_HOST=0.0.0.0 SPUR_PORT=8080 SPUR_DATEN=/daten
VOLUME ["/daten"]
EXPOSE 8080
HEALTHCHECK --interval=15s --timeout=3s --retries=3 CMD wget -qO- http://127.0.0.1:8080/api/v1/status > /dev/null || exit 1
CMD ["node", "server/start.js"]
