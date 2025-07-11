# Exemples d'utilisation des Relations

Ce document présente des exemples pratiques d'utilisation du système de relations de JamesDbApi.

## 🔗 Types de Relations Supportées

### 1. **hasOne** - Relation Un-à-Un
Une table possède un seul enregistrement dans une autre table.

```json
{
  "type": "hasOne",
  "target": "profiles",
  "foreignKey": "user_id",
  "as": "profile"
}
```

### 2. **hasMany** - Relation Un-à-Plusieurs
Une table possède plusieurs enregistrements dans une autre table.

```json
{
  "type": "hasMany",
  "target": "posts",
  "foreignKey": "user_id",
  "as": "posts"
}
```

### 3. **belongsTo** - Relation Plusieurs-à-Un
Plusieurs enregistrements appartiennent à un seul enregistrement.

```json
{
  "type": "belongsTo",
  "target": "users",
  "foreignKey": "user_id",
  "as": "author"
}
```

### 4. **belongsToMany** - Relation Plusieurs-à-Plusieurs
Relation via une table de jonction.

```json
{
  "type": "belongsToMany",
  "target": "roles",
  "through": "user_roles",
  "foreignKey": "user_id",
  "as": "roles"
}
```

## 📊 Exemple Complet : Système de Blog

### Créer les tables avec relations

```bash
curl -X POST http://localhost:3000/api/_relations/primary/create-with-relations \
  -H "Content-Type: application/json" \
  -d '[
    {
      "table_name": "users",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "email", "type": "email", "unique": true, "nullable": false},
        {"name": "name", "type": "string", "length": 100, "nullable": false},
        {"name": "created_at", "type": "timestamp", "default_value": "CURRENT_TIMESTAMP"}
      ],
      "relations": [
        {"type": "hasMany", "target": "posts", "foreignKey": "user_id", "as": "posts"},
        {"type": "hasOne", "target": "profiles", "foreignKey": "user_id", "as": "profile"},
        {"type": "belongsToMany", "target": "roles", "through": "user_roles", "foreignKey": "user_id", "as": "roles"}
      ]
    },
    {
      "table_name": "posts",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "title", "type": "string", "length": 255, "nullable": false},
        {"name": "content", "type": "text"},
        {"name": "user_id", "type": "integer", "nullable": false},
        {"name": "category_id", "type": "integer"},
        {"name": "published_at", "type": "timestamp"},
        {"name": "created_at", "type": "timestamp", "default_value": "CURRENT_TIMESTAMP"}
      ],
      "relations": [
        {"type": "belongsTo", "target": "users", "foreignKey": "user_id", "as": "author"},
        {"type": "belongsTo", "target": "categories", "foreignKey": "category_id", "as": "category"},
        {"type": "belongsToMany", "target": "tags", "through": "post_tags", "foreignKey": "post_id", "as": "tags"}
      ]
    },
    {
      "table_name": "profiles",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "user_id", "type": "integer", "unique": true, "nullable": false},
        {"name": "bio", "type": "text"},
        {"name": "avatar_url", "type": "url"},
        {"name": "birth_date", "type": "date"},
        {"name": "website", "type": "url"}
      ],
      "relations": [
        {"type": "belongsTo", "target": "users", "foreignKey": "user_id", "as": "user"}
      ]
    },
    {
      "table_name": "categories",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "name", "type": "string", "length": 100, "unique": true, "nullable": false},
        {"name": "slug", "type": "string", "length": 100, "unique": true},
        {"name": "description", "type": "text"},
        {"name": "parent_id", "type": "integer"}
      ],
      "relations": [
        {"type": "hasMany", "target": "posts", "foreignKey": "category_id", "as": "posts"},
        {"type": "hasMany", "target": "categories", "foreignKey": "parent_id", "as": "children"},
        {"type": "belongsTo", "target": "categories", "foreignKey": "parent_id", "as": "parent"}
      ]
    },
    {
      "table_name": "tags",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "name", "type": "string", "length": 50, "unique": true, "nullable": false},
        {"name": "color", "type": "string", "length": 7, "default_value": "#000000"}
      ],
      "relations": [
        {"type": "belongsToMany", "target": "posts", "through": "post_tags", "foreignKey": "tag_id", "as": "posts"}
      ]
    },
    {
      "table_name": "roles",
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true, "auto_increment": true},
        {"name": "name", "type": "string", "length": 50, "unique": true, "nullable": false},
        {"name": "permissions", "type": "json"},
        {"name": "description", "type": "text"}
      ],
      "relations": [
        {"type": "belongsToMany", "target": "users", "through": "user_roles", "foreignKey": "role_id", "as": "users"}
      ]
    },
    {
      "table_name": "user_roles",
      "columns": [
        {"name": "user_id", "type": "integer", "primary_key": true},
        {"name": "role_id", "type": "integer", "primary_key": true},
        {"name": "granted_at", "type": "timestamp", "default_value": "CURRENT_TIMESTAMP"},
        {"name": "granted_by", "type": "integer"}
      ]
    },
    {
      "table_name": "post_tags",
      "columns": [
        {"name": "post_id", "type": "integer", "primary_key": true},
        {"name": "tag_id", "type": "integer", "primary_key": true},
        {"name": "added_at", "type": "timestamp", "default_value": "CURRENT_TIMESTAMP"}
      ]
    }
  ]'
```

## 🔍 Utilisation des Relations

### 1. Valider des relations avant création

```bash
curl -X POST http://localhost:3000/api/_relations/validate \
  -H "Content-Type: application/json" \
  -d '[
    {
      "table_name": "users",
      "columns": [{"name": "id", "type": "integer", "primary_key": true}],
      "relations": [
        {"type": "hasMany", "target": "posts", "foreignKey": "user_id"}
      ]
    },
    {
      "table_name": "posts", 
      "columns": [
        {"name": "id", "type": "integer", "primary_key": true},
        {"name": "user_id", "type": "integer"}
      ],
      "relations": [
        {"type": "belongsTo", "target": "users", "foreignKey": "user_id"}
      ]
    }
  ]'
```

### 2. Établir des relations sur des tables existantes

```bash
curl -X POST http://localhost:3000/api/_relations/primary/establish \
  -H "Content-Type: application/json" \
  -d '[
    {
      "table_name": "existing_users",
      "columns": [{"name": "id", "type": "integer", "primary_key": true}],
      "relations": [
        {"type": "hasMany", "target": "existing_posts", "foreignKey": "author_id", "as": "articles"}
      ]
    }
  ]'
```

### 3. Consulter les modèles et leurs relations

```bash
# Lister tous les modèles
curl http://localhost:3000/api/_relations/primary/models

# Voir les relations d'un modèle spécifique
curl http://localhost:3000/api/_relations/primary/users/associations
```

### 4. Obtenir un exemple complet

```bash
curl http://localhost:3000/api/_relations/example
```

## 🎯 Cas d'Usage Avancés

### Relations avec contraintes personnalisées

```json
{
  "type": "hasMany",
  "target": "posts",
  "foreignKey": "author_id",
  "as": "publishedPosts",
  "scope": {
    "published": true
  },
  "onDelete": "CASCADE",
  "onUpdate": "CASCADE"
}
```

### Relations auto-référentielles

```json
{
  "table_name": "categories",
  "relations": [
    {
      "type": "hasMany",
      "target": "categories",
      "foreignKey": "parent_id",
      "as": "subcategories"
    },
    {
      "type": "belongsTo",
      "target": "categories", 
      "foreignKey": "parent_id",
      "as": "parentCategory"
    }
  ]
}
```

### Relations polymorphes simulées

```json
{
  "table_name": "comments",
  "columns": [
    {"name": "commentable_type", "type": "string"},
    {"name": "commentable_id", "type": "integer"}
  ],
  "relations": [
    {
      "type": "belongsTo",
      "target": "posts",
      "foreignKey": "commentable_id",
      "as": "post",
      "scope": {"commentable_type": "Post"}
    },
    {
      "type": "belongsTo", 
      "target": "users",
      "foreignKey": "commentable_id",
      "as": "user",
      "scope": {"commentable_type": "User"}
    }
  ]
}
```

## ⚠️ Bonnes Pratiques

### 1. **Nommage des clés étrangères**
- Utilisez le format `{table}_id` (ex: `user_id`, `category_id`)
- Soyez cohérent dans toute votre base

### 2. **Alias des relations**
- Utilisez des noms descriptifs pour `as`
- Évitez les conflits avec les noms de colonnes

### 3. **Tables de jonction**
- Nommez-les `{table1}_{table2}` (ex: `user_roles`, `post_tags`)
- Ajoutez des métadonnées utiles (timestamps, etc.)

### 4. **Contraintes référentielles**
- Utilisez `CASCADE` pour les suppressions en cascade
- Préférez `SET NULL` pour les relations optionnelles

### 5. **Performance**
- Créez des index sur les clés étrangères
- Utilisez des contraintes pour maintenir l'intégrité

## 🚨 Gestion d'Erreurs

### Erreurs communes et solutions

```json
// Erreur: Table cible inexistante
{
  "error": "Relations validation failed",
  "errors": ["users: Relation 0 references non-existent table 'posts'"]
}

// Erreur: Clé étrangère manquante
{
  "error": "Relations validation failed", 
  "errors": ["posts: Foreign key 'user_id' not found in posts"]
}

// Erreur: Table de jonction requise
{
  "error": "Relations validation failed",
  "errors": ["users: belongsToMany relation to 'roles' requires 'through' property"]
}
```

## 📈 Monitoring des Relations

### Vérifier l'état des relations

```bash
# Statistiques générales
curl http://localhost:3000/api/_relations/primary/models

# Relations spécifiques
curl http://localhost:3000/api/_relations/primary/users/associations

# Validation continue
curl -X POST http://localhost:3000/api/_relations/validate \
  -H "Content-Type: application/json" \
  -d @your-schemas.json
```

---

Ce système de relations vous permet de créer des structures de données complexes et maintenables avec toute la puissance de Sequelize ! 🚀
