
> ⚠️ **Project under active development**: Some features may be incomplete, unstable, or not working as expected. Please open an issue for any bug or suggestion!

# JamesDbApi

A robust and modern database management API built with Hono, Sequelize, and TypeScript. JamesDbApi provides a powerful RESTful interface to manage multiple databases, create dynamic schemas, and execute queries securely.

## 🚀 Features

### Multi-Database Management
- **Multiple DBMS support**: SQLite, PostgreSQL, MySQL, MariaDB, MSSQL
- **Simultaneous connections**: Manage multiple databases in parallel
- **Health checks**: Real-time monitoring of connection status
- **Dynamic configuration**: Add/remove databases on the fly

### Complete Schema API
- **Dynamic table creation**: REST API to define your schemas
- **Advanced validation**: Strict validation of data structures
- **Extended types**: Support for 25+ SQL data types
- **Constraints and indexes**: Complete management of constraints and indexes

### Advanced Security
- **JWT authentication**: Token-based authentication system
- **Role-based authorization**: Granular access control
- **Rate limiting**: Protection against abuse and DDoS attacks
- **Security headers**: CORS, CSRF, HSTS, and more

### Performance and Monitoring
- **Structured logging**: Detailed logs with configurable levels
- **Real-time metrics**: Monitoring endpoints and metrics
- **Optimizations**: Connection pooling, cache, and SQL optimizations

## 📋 Prerequisites

- **Node.js** >= 18.0.0 or **Bun** >= 1.0.0
- A supported database (optional, SQLite by default)

## 🛠️ Installation

### Quick Installation

```bash
# Clone the project
git clone <repository-url>
cd JamesDbApi

# Install dependencies
bun install

# Copy configuration
cp .env.example .env

# Start in development mode
bun run dev
```

### Configuration

Edit the `.env` file according to your needs:

```env
# Application configuration
NODE_ENV=development
APP_PORT=3000
APP_HOST=localhost
API_VERSION=v1

# Primary database (SQLite by default)
DB_DIALECT=sqlite
SQLITE_PATH=./data/james.db

# For PostgreSQL
# DB_DIALECT=postgres
# DB_HOST=localhost
# DB_PORT=5432
# DB_USER=postgres
# DB_PASSWORD=password
# DB_NAME=james_db

# Security
JWT_SECRET=your-super-secret-jwt-key-here
CORS_ORIGINS=http://localhost:3000
```

## 🚀 Quick Start

### 1. Start the server

```bash
# Development with auto-reload
bun run dev

# Production
bun run prod

# With Docker
docker build -t jamesdbapi .
docker run -p 3000:3000 jamesdbapi
```

### 2. Verify operation

```bash
# Health check
curl http://localhost:3000/health

# API info
curl http://localhost:3000/api
```

### 3. Create your first table

```bash
curl -X POST http://localhost:3000/api/_schema/primary/tables \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "users",
    "columns": [
      {
        "name": "id",
        "type": "integer",
        "primary_key": true,
        "auto_increment": true
      },
      {
        "name": "email",
        "type": "email",
        "unique": true,
        "nullable": false
      },
      {
        "name": "name",
        "type": "string",
        "length": 100,
        "nullable": false
      },
      {
        "name": "created_at",
        "type": "timestamp",
        "default_value": "CURRENT_TIMESTAMP"
      }
    ]
  }'
```

## 📚 API Documentation

### Main Endpoints

#### 🏠 Application
- `GET /` - API homepage
- `GET /health` - Complete health check
- `GET /metrics` - System metrics
- `GET /api` - API information

#### 🗄️ Database Management
- `GET /api/_database` - List databases
- `POST /api/_database/connect` - Connect a new database
- `DELETE /api/_database/:name` - Disconnect a database
- `GET /api/_database/:name/info` - Detailed information
- `POST /api/_database/:name/query` - Execute SQL query

#### 📋 Schema Management
- `GET /api/_schema` - Schema overview
- `GET /api/_schema/types` - Available data types
- `POST /api/_schema/validate` - Validate a schema
- `GET /api/_schema/:database/tables` - List tables
- `POST /api/_schema/:database/tables` - Create table
- `GET /api/_schema/:database/tables/:table` - Describe table
- `DELETE /api/_schema/:database/tables/:table` - Delete table

### Usage Examples

#### Connect a PostgreSQL database

```bash
curl -X POST http://localhost:3000/api/_database/connect \
  -H "Content-Type: application/json" \
  -d '{
    "name": "postgres_main",
    "config": {
      "dialect": "postgres",
      "host": "localhost",
      "port": 5432,
      "user": "postgres",
      "password": "password",
      "database": "my_app"
    }
  }'
```

#### Create a table with constraints

```bash
curl -X POST http://localhost:3000/api/_schema/postgres_main/tables \
  -H "Content-Type: application/json" \
  -d '{
    "table_name": "products",
    "columns": [
      {
        "name": "id",
        "type": "uuid",
        "primary_key": true,
        "default_value": "uuid_generate_v4()"
      },
      {
        "name": "name",
        "type": "string",
        "length": 255,
        "nullable": false
      },
      {
        "name": "price",
        "type": "decimal",
        "precision": 10,
        "scale": 2,
        "validate": {
          "min": 0
        }
      },
      {
        "name": "category_id",
        "type": "integer",
        "foreign_key": {
          "table": "categories",
          "column": "id",
          "on_delete": "CASCADE"
        }
      }
    ],
    "indexes": [
      {
        "name": "idx_products_name",
        "columns": ["name"],
        "unique": false
      },
      {
        "name": "idx_products_category",
        "columns": ["category_id"],
        "type": "BTREE"
      }
    ]
  }'
```

#### Execute a query

```bash
curl -X POST http://localhost:3000/api/_database/postgres_main/query \
  -H "Content-Type: application/json" \
  -d '{
    "query": "SELECT * FROM products WHERE price > 100 ORDER BY name LIMIT 10",
    "type": "SELECT"
  }'
```

## 🔧 Advanced Configuration

### Environment Variables

| Variable | Description | Default | Example |
|----------|-------------|---------|---------|
| `NODE_ENV` | Runtime environment | `development` | `production` |
| `APP_PORT` | Listening port | `3000` | `8080` |
| `LOG_LEVEL` | Log level | `info` | `debug` |
| `JWT_SECRET` | JWT secret key | Auto-generated | `your-secret-key` |
| `RATE_LIMIT_MAX_REQUESTS` | Request limit | `100` | `1000` |

### Supported Data Types

#### Numeric Types
- `integer`, `int` - Standard integer
- `smallint` - Small integer
- `bigint` - Large integer
- `float`, `double` - Floating point numbers
- `decimal`, `numeric` - Precise decimal numbers

#### Text Types
- `string`, `varchar` - Variable character string
- `char` - Fixed character string
- `text` - Long text
- `email` - Email with validation
- `url` - URL with validation

#### Date/Time Types
- `timestamp`, `datetime` - Date and time
- `date` - Date only
- `time` - Time only

#### Special Types
- `boolean` - Boolean
- `uuid` - Unique identifier
- `json`, `jsonb` - JSON data
- `blob` - Binary data

### Authentication and Security

#### JWT Token Generation

```javascript
// Client-side example
const response = await fetch('/api/auth/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    username: 'admin',
    password: 'password'
  })
});

const { token } = await response.json();

// Using the token
const apiResponse = await fetch('/api/_database', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

#### Authorization Middleware

```typescript
import { authenticate, authorize, requireRole } from './middlewares/auth';

// Protected routes
app.use('/api/_database/*', authenticate());
app.use('/api/_schema/*/tables', authorize('database:write'));
app.use('/api/admin/*', requireRole('admin'));
```

## 🧪 Testing and Development

### Available Scripts

```bash
# Development
bun run dev          # Start with auto-reload
bun run build        # Build for production
bun run start        # Run built version

# Testing
bun run test         # Run tests
bun run test:watch   # Tests in watch mode

# Code quality
bun run lint         # Check code style
bun run format       # Format code

# Database
bun run db:migrate   # Apply migrations
bun run db:seed      # Seed with test data
bun run db:reset     # Reset database

# Docker
bun run docker:build # Build Docker image
bun run docker:run   # Run container
```

### Project Structure

```
JamesDbApi/
├── controllers/           # Controllers (to be implemented)
├── managers/
│   └── ConfigManager.ts   # Configuration manager
├── middlewares/
│   ├── auth.ts           # JWT authentication
│   ├── databaseManager.ts # Database manager
│   └── rateLimiter.ts    # Rate limiting
├── routes/
│   ├── _database.routes.ts # Database routes
│   └── _schema.routes.ts   # Schema routes
├── utils/
│   ├── convert.ts        # Schema conversion
│   ├── logging.ts        # Logging system
│   ├── runtime.ts        # Runtime detection
│   └── types.ts          # TypeScript types
├── index.ts              # Entry point
├── package.json
├── tsconfig.json
└── .env.example
```

## 🔍 Monitoring and Debugging

### Monitoring Endpoints

```bash
# Detailed health check
curl http://localhost:3000/health

# System metrics
curl http://localhost:3000/metrics

# Rate limiter status
curl http://localhost:3000/api/_database/rate-limit-status
```

### Logs

Logs are structured and include:
- **Timestamp**: Precise timestamp
- **Logger**: Log source (DatabaseManager, AuthManager, etc.)
- **Level**: Log level (DEBUG, INFO, WARN, ERROR)
- **Message**: Detailed message

Example:
```
[2025-07-11T10:30:45.123Z] [DatabaseManager] [INFO]: Database 'primary' added and connected successfully
[2025-07-11T10:30:45.456Z] [AuthManager] [WARN]: Token expired for user john.doe
```

## 🚨 Security and Best Practices

### Built-in Security
- **HTTPS required** in production
- **Strict input validation**
- **Rate limiting** by IP and user
- **Automatic security headers**
- **SQL sanitization** via Sequelize

### Recommendations
1. **Change default secrets** in production
2. **Use HTTPS only** in production
3. **Limit database user permissions**
4. **Monitor logs** regularly
5. **Update dependencies** regularly

## 🤝 Contributing

### Contribution Guide

1. **Fork** the project
2. **Create** a branch for your feature
3. **Develop** following conventions
4. **Test** your code
5. **Create** a Pull Request

### Code Standards

- **Strict TypeScript** enabled
- **ESLint** and **Prettier** for style
- **Unit tests** required for new features
- **Public API documentation**

## 📈 Roadmap

### Version 1.1 (Coming Soon)
- [ ] GraphQL interface
- [ ] Integrated Redis cache
- [ ] Automatic migrations
- [ ] Web administration interface

### Version 1.2 (Planned)
- [ ] Clustering and load balancing
- [ ] Complete audit trail
- [ ] Automatic backup
- [ ] API Analytics

## 🆘 Support and Troubleshooting

### Common Issues

#### Database connection error
```bash
# Check configuration
curl http://localhost:3000/health

# Check logs
tail -f logs/app.log
```

#### Rate limiting too strict
```env
# Adjust in .env
RATE_LIMIT_MAX_REQUESTS=1000
RATE_LIMIT_WINDOW_MS=3600000
```

#### JWT errors
```env
# Generate new secret
JWT_SECRET=$(openssl rand -base64 32)
```

### Support

- **Issues**: [GitHub Issues](https://github.com/your-repo/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-repo/discussions)
- **Documentation**: [Wiki](https://github.com/your-repo/wiki)

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for more details.

---

**JamesDbApi** - A modern database API for your applications 🚀

Developed with ❤️ by the James team
