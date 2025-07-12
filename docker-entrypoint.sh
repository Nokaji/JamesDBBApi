#!/bin/bash

# Script de démarrage pour Docker
set -e

echo "🚀 Starting JamesDbApi in Docker..."

# Variables d'environnement par défaut
export NODE_ENV="${NODE_ENV:-production}"
export PORT="${PORT:-3000}"

# Vérifier les dépendances critiques
echo "📋 Checking dependencies..."

# Si on utilise PostgreSQL, attendre qu'il soit prêt
if [ "${DB_TYPE}" = "postgres" ]; then
    echo "⏳ Waiting for PostgreSQL..."
    until pg_isready -h "${DB_HOST:-postgres}" -p "${DB_PORT:-5432}" -U "${DB_USER:-james}"; do
        echo "PostgreSQL is unavailable - sleeping"
        sleep 2
    done
    echo "✅ PostgreSQL is ready!"
fi

# Si on utilise MySQL, attendre qu'il soit prêt
if [ "${DB_TYPE}" = "mysql" ] || [ "${DB_TYPE}" = "mariadb" ]; then
    echo "⏳ Waiting for MySQL/MariaDB..."
    until mysqladmin ping -h"${DB_HOST:-mysql}" -P"${DB_PORT:-3306}" -u"${DB_USER:-james}" -p"${DB_PASSWORD}" --silent; do
        echo "MySQL/MariaDB is unavailable - sleeping"
        sleep 2
    done
    echo "✅ MySQL/MariaDB is ready!"
fi

# Créer les répertoires nécessaires
echo "📁 Creating directories..."
mkdir -p /app/logs /app/data /app/uploads /app/temp

# Vérifier les permissions
echo "🔐 Checking permissions..."
if [ ! -w /app/logs ]; then
    echo "❌ Cannot write to logs directory"
    exit 1
fi

# Démarrer l'application
echo "🌟 Starting application..."
exec bun run start
