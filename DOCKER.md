# Docker Setup pour JamesDbApi

## 🚀 Démarrage Rapide

### Avec SQLite (Simple)
```bash
# Construire l'image
docker build -t jamesdbapi .

# Lancer l'application
docker run -p 3000:3000 -e DB_TYPE=sqlite jamesdbapi
```

### Avec PostgreSQL (Recommandé pour la production)
```bash
# Lancer avec docker-compose
docker-compose up -d

# Ou construire et lancer manuellement
docker build -t jamesdbapi .
docker run -p 3000:3000 \
  -e DB_TYPE=postgres \
  -e DB_HOST=your-postgres-host \
  -e DB_USER=your-user \
  -e DB_PASSWORD=your-password \
  -e DB_NAME=your-database \
  jamesdbapi
```

## 📋 Variables d'Environnement

### Base de Données
```bash
DB_TYPE=postgres          # sqlite, postgres, mysql, mariadb, mssql
DB_HOST=localhost         # Hôte de la base de données
DB_PORT=5432             # Port de la base de données
DB_USER=james            # Utilisateur
DB_PASSWORD=password     # Mot de passe
DB_NAME=jamesdb          # Nom de la base
```

### Sécurité
```bash
JWT_SECRET=your-secret   # Clé secrète JWT (OBLIGATOIRE en production)
JWT_EXPIRY=24h          # Durée de validité des tokens
```

### Application
```bash
NODE_ENV=production     # production, development
PORT=3000              # Port d'écoute
LOG_LEVEL=info         # debug, info, warn, error
```

## 🐳 Docker Compose

### Configuration Complète
Le fichier `docker-compose.yml` inclut :
- **JamesDbApi** : Application principale
- **PostgreSQL** : Base de données
- **Redis** : Cache et sessions
- **Adminer** : Interface d'administration (profil `admin`)
- **Nginx** : Reverse proxy (profil `nginx`)

### Commandes Utiles
```bash
# Démarrer tous les services
docker-compose up -d

# Démarrer avec Adminer pour l'administration
docker-compose --profile admin up -d

# Démarrer avec Nginx
docker-compose --profile nginx up -d

# Voir les logs
docker-compose logs -f jamesdbapi

# Arrêter les services
docker-compose down

# Arrêter et supprimer les volumes
docker-compose down -v
```

## 🔧 Builds Optimisés

### Build de Développement
```bash
docker build --target development -t jamesdbapi:dev .
docker run -p 3000:3000 -v $(pwd):/app jamesdbapi:dev
```

### Build de Production
```bash
docker build --target production -t jamesdbapi:prod .
docker run -p 3000:3000 jamesdbapi:prod
```

## 📊 Monitoring

### Health Check
```bash
# Vérifier la santé de l'application
docker exec container-name curl -f http://localhost:3000/health

# Ou depuis l'hôte
curl http://localhost:3000/health
```

### Métriques
```bash
curl http://localhost:3000/metrics
```

### Logs
```bash
# Logs de l'application
docker logs -f jamesdbapi

# Logs de la base de données
docker logs -f jamesdb-postgres
```

## 🔐 Sécurité

### Bonnes Pratiques
1. **Changez les mots de passe par défaut** dans `docker-compose.yml`
2. **Utilisez des secrets Docker** pour les informations sensibles
3. **Configurez un reverse proxy** (Nginx) pour HTTPS
4. **Limitez l'exposition des ports** (ne pas exposer PostgreSQL en production)

### Exemple avec Secrets
```yaml
# docker-compose.yml
services:
  jamesdbapi:
    environment:
      - DB_PASSWORD_FILE=/run/secrets/db_password
    secrets:
      - db_password

secrets:
  db_password:
    file: ./secrets/db_password.txt
```

## 🚨 Résolution de Problèmes

### Application ne démarre pas
```bash
# Vérifier les logs
docker logs jamesdbapi

# Vérifier la connectivité base de données
docker exec jamesdbapi nc -z postgres 5432
```

### Base de données inaccessible
```bash
# Vérifier que PostgreSQL est prêt
docker exec jamesdb-postgres pg_isready -U james

# Tester la connexion
docker exec jamesdbapi psql -h postgres -U james -d jamesdb -c "SELECT 1;"
```

### Erreurs de permissions
```bash
# Vérifier les permissions des volumes
ls -la data/ logs/ uploads/

# Corriger les permissions
sudo chown -R 1001:1001 data/ logs/ uploads/
```

## 🔄 Mise à Jour

### Application
```bash
# Reconstruire l'image
docker build -t jamesdbapi:latest .

# Redémarrer le service
docker-compose up -d jamesdbapi
```

### Base de données
```bash
# Sauvegarde avant mise à jour
docker exec jamesdb-postgres pg_dump -U james jamesdb > backup.sql

# Mise à jour PostgreSQL
docker-compose pull postgres
docker-compose up -d postgres
```

## 📦 Images Multi-Architecture

### Construire pour ARM64 (Apple Silicon)
```bash
docker buildx build --platform linux/arm64 -t jamesdbapi:arm64 .
```

### Construire pour x86_64
```bash
docker buildx build --platform linux/amd64 -t jamesdbapi:amd64 .
```

### Image Universal
```bash
docker buildx build --platform linux/amd64,linux/arm64 -t jamesdbapi:universal --push .
```

---

## 🆘 Support

Pour obtenir de l'aide :
1. Consultez les logs : `docker logs jamesdbapi`
2. Vérifiez la santé : `curl http://localhost:3000/health`
3. Testez la connectivité réseau entre les conteneurs

**Note** : En cas d'erreur `SQLITE_MISUSE`, c'est normal lors de l'arrêt - l'application gère maintenant ces erreurs de manière gracieuse.
