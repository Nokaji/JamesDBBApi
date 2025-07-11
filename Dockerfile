# Multi-stage build pour optimiser la taille de l'image
FROM oven/bun:1.2.18-alpine AS base

# Variables d'environnement
ENV NODE_ENV=production
ENV PORT=3000
ENV BUNS_NO_CLEAR_TERMINAL_ON_RELOAD=true

# Créer un utilisateur non-root pour la sécurité
RUN addgroup -g 1001 -S nodejs && \
    adduser -S bunuser -u 1001

# Définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de configuration des dépendances
COPY package.json bun.lockb* ./

# Stage de développement
FROM base AS development
ENV NODE_ENV=development
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
USER bunuser
CMD ["bun", "run", "dev"]

# Stage de build
FROM base AS builder
ENV NODE_ENV=production

# Installer toutes les dépendances (y compris dev pour build)
RUN bun install --frozen-lockfile --production=false

# Copier le code source
COPY . .

# Build de l'application (si nécessaire)
RUN bun run build || echo "No build script found, skipping..."

# Nettoyer les dev dependencies
RUN bun install --frozen-lockfile --production=true

# Stage de production
FROM base AS production

# Installer seulement les dépendances de production
RUN bun install --frozen-lockfile --production=true && \
    bun pm cache rm

# Copier l'application buildée
COPY --from=builder --chown=bunuser:nodejs /app .

# Copier et rendre exécutable le script d'entrée
COPY --chown=bunuser:nodejs docker-entrypoint.sh /app/
RUN chmod +x /app/docker-entrypoint.sh

# Créer les répertoires nécessaires
RUN mkdir -p logs data uploads temp && \
    chown -R bunuser:nodejs logs data uploads temp

# Installer les outils système nécessaires pour les bases de données
RUN apk add --no-cache \
    sqlite \
    postgresql-client \
    mysql-client \
    curl \
    ca-certificates

# Exposer le port
EXPOSE 3000

# Ajouter un healthcheck
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

# Changer vers l'utilisateur non-root
USER bunuser

# Commande par défaut
ENTRYPOINT ["/app/docker-entrypoint.sh"]
