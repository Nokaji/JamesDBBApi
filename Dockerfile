# Multi-stage build pour optimiser la taille de l'image
FROM oven/bun:1.2.18-alpine AS base
WORKDIR /usr/src/app
VOLUME [ "/usr/src/app/data" ]
COPY . .
RUN sed -i 's/\r$//' /usr/src/app/docker-entrypoint.sh \
    && chmod +x /usr/src/app/docker-entrypoint.sh
RUN bun install --production

# run the app
USER bun
EXPOSE 3000/tcp
# Définir le point d'entrée
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]