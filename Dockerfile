# Multi-stage build pour optimiser la taille de l'image
FROM oven/bun:1.2.18-alpine AS base
WORKDIR /usr/src/app
VOLUME [ "/usr/src/app/data" ]

# copy entrypoint script
COPY docker-entrypoint.sh /usr/src/app/docker-entrypoint.sh
RUN chmod +x /usr/src/app/docker-entrypoint.sh
# install dependencies
FROM base AS install
COPY package.json bun.lockb ./
RUN bun install --production
# copy source code
COPY . .

# run the app
USER bun
EXPOSE 3000/tcp
# Définir le point d'entrée
ENTRYPOINT ["/usr/src/app/docker-entrypoint.sh"]