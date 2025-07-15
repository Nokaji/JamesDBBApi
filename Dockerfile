# Multi-stage build pour optimiser la taille de l'image
FROM oven/bun:1.2.18-alpine AS base
WORKDIR /usr/src/app
VOLUME [ "/usr/src/app/data" ]
COPY . .
RUN sed -i 's/\r$//' /usr/src/app/docker-entrypoint.sh \
    && chmod +x /usr/src/app/docker-entrypoint.sh
RUN bun install --production

# Créer le dossier dist et donner les droits à bun
RUN mkdir -p /usr/src/app/dist \
    && chown bun:bun /usr/src/app/dist

# run the app
USER bun
EXPOSE 3000/tcp
# Définir le point d'entrée
ENTRYPOINT ["bun", "run", "start"]