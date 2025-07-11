#!/bin/bash

# Script de validation complète de JamesDbApi

echo "🔍 Validation complète de JamesDbApi..."

BASE_URL="http://localhost:3000"

# Couleurs pour les messages
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Fonction pour tester un endpoint
test_endpoint() {
    local method=$1
    local endpoint=$2
    local expected_code=$3
    local description=$4
    
    echo -n "Testing $description... "
    
    local response
    if [ "$method" = "GET" ]; then
        response=$(curl -s -w "%{http_code}" "$BASE_URL$endpoint" -o /dev/null)
    else
        response=$(curl -s -w "%{http_code}" -X "$method" "$BASE_URL$endpoint" -H "Content-Type: application/json" -d '{}' -o /dev/null)
    fi
    
    if [ "$response" = "$expected_code" ]; then
        echo -e "${GREEN}✅ PASS${NC} ($response)"
    else
        echo -e "${RED}❌ FAIL${NC} (expected $expected_code, got $response)"
        return 1
    fi
}

# Tests des endpoints principaux
echo "🌐 Tests des endpoints principaux:"
test_endpoint "GET" "/" "200" "Root endpoint"
test_endpoint "GET" "/api" "200" "API info"
test_endpoint "GET" "/health" "200" "Health check"
test_endpoint "GET" "/metrics" "200" "Metrics"
test_endpoint "GET" "/docs" "200" "Documentation"
test_endpoint "GET" "/api/swagger.json" "200" "Swagger JSON"

echo ""
echo "🗄️  Tests des endpoints de base de données:"
test_endpoint "GET" "/api/_database/list" "200" "List databases"
test_endpoint "GET" "/api/_schema" "200" "Schema operations"

echo ""
echo "🔗 Tests des endpoints de relations:"
test_endpoint "GET" "/api/_relations" "200" "Relations operations"
test_endpoint "POST" "/api/_relations/validate" "400" "Relations validation (sans données)"

echo ""
echo "❌ Tests des erreurs 404:"
test_endpoint "GET" "/nonexistent" "404" "404 handler"

echo ""
echo "📊 Test de validation JSON Swagger:"
SWAGGER_JSON=$(curl -s "$BASE_URL/api/swagger.json")
if echo "$SWAGGER_JSON" | jq . > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Swagger JSON est valide${NC}"
else
    echo -e "${RED}❌ Swagger JSON est invalide${NC}"
fi

echo ""
echo "🧪 Test d'arrêt gracieux:"
PID=$(pgrep -f "bun.*index.ts")
if [ -n "$PID" ]; then
    echo "Envoi de SIGTERM au processus $PID..."
    kill -TERM $PID
    sleep 2
    if ! pgrep -f "bun.*index.ts" > /dev/null; then
        echo -e "${GREEN}✅ Arrêt gracieux réussi${NC}"
    else
        echo -e "${YELLOW}⚠️  Processus encore en cours${NC}"
        kill -KILL $PID
    fi
else
    echo -e "${YELLOW}⚠️  Aucun processus trouvé${NC}"
fi

echo ""
echo "🏁 Validation terminée!"
