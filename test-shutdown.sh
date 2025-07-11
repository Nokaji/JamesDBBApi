#!/bin/bash

# Script de test pour vérifier la correction du problème de fermeture SQLite

echo "🧪 Test du shutdown gracieux..."

# Démarrer l'application en arrière-plan
echo "▶️  Démarrage de l'application..."
cd /workspace/JamesDbApi
bun run index.ts &
APP_PID=$!

# Attendre que l'application démarre
echo "⏳ Attente du démarrage (5 secondes)..."
sleep 5

# Vérifier que l'application répond
echo "🏥 Test de santé..."
if curl -f http://localhost:3000/health > /dev/null 2>&1; then
    echo "✅ Application en marche"
else
    echo "❌ Application ne répond pas"
    kill $APP_PID 2>/dev/null
    exit 1
fi

# Envoyer SIGTERM pour tester l'arrêt gracieux
echo "🛑 Envoi du signal SIGTERM..."
kill -TERM $APP_PID

# Attendre la fermeture
echo "⏳ Attente de la fermeture..."
wait $APP_PID
EXIT_CODE=$?

if [ $EXIT_CODE -eq 0 ]; then
    echo "✅ Arrêt gracieux réussi (code de sortie: $EXIT_CODE)"
else
    echo "⚠️  Arrêt avec avertissements (code de sortie: $EXIT_CODE)"
fi

echo "🏁 Test terminé"
