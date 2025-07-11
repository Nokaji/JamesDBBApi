import ConfigManager from '../managers/ConfigManager';

export const generateSwaggerSpec = () => {
    return {
        openapi: "3.0.0",
        info: {
            title: "JamesDbApi Documentation",
            version: ConfigManager.APP.API_VERSION,
            description: "REST API for database management and operations",
            contact: {
                name: "JamesDbApi Support",
                url: "https://github.com/nokaji/kernel-james"
            },
            license: {
                name: "MIT",
                url: "https://opensource.org/licenses/MIT"
            },
        },
        servers: [
            {
                url: `http://localhost:${ConfigManager.APP.PORT}`,
                description: "Development server"
            },
            {
                url: "/",
                description: "Current server"
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: "http",
                    scheme: "bearer",
                    bearerFormat: "JWT"
                }
            },
            schemas: {
                Error: {
                    type: "object",
                    properties: {
                        error: { type: "string" },
                        message: { type: "string" },
                        timestamp: { type: "number" }
                    }
                },
                DatabaseConfig: {
                    type: "object",
                    properties: {
                        dialect: {
                            type: "string",
                            enum: ["sqlite", "postgres", "mysql", "mariadb", "mssql"]
                        },
                        host: { type: "string" },
                        port: { type: "number" },
                        database: { type: "string" },
                        user: { type: "string" },
                        password: { type: "string" }
                    }
                },
                TableColumn: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Column name",
                            example: "email"
                        },
                        type: {
                            type: "string",
                            description: "Data type",
                            enum: [
                                "string", "text", "integer", "bigint", "float", "double", "decimal",
                                "boolean", "date", "datetime", "timestamp", "time", "json", "jsonb",
                                "uuid", "email", "url", "phone", "enum", "array", "binary", "blob"
                            ],
                            example: "string"
                        },
                        nullable: {
                            type: "boolean",
                            description: "Can be null",
                            default: true
                        },
                        primary_key: {
                            type: "boolean",
                            description: "Is primary key",
                            default: false
                        },
                        auto_increment: {
                            type: "boolean",
                            description: "Auto increment",
                            default: false
                        },
                        unique: {
                            type: "boolean",
                            description: "Must be unique",
                            default: false
                        },
                        default_value: {
                            type: "string",
                            description: "Default value"
                        },
                        length: {
                            type: "number",
                            description: "Maximum length for string types"
                        },
                        precision: {
                            type: "number",
                            description: "Precision for decimal types"
                        },
                        scale: {
                            type: "number",
                            description: "Scale for decimal types"
                        },
                        enum_values: {
                            type: "array",
                            items: { type: "string" },
                            description: "Possible values for enum type"
                        }
                    },
                    required: ["name", "type"]
                },
                TableRelation: {
                    type: "object",
                    properties: {
                        type: {
                            type: "string",
                            enum: ["hasOne", "hasMany", "belongsTo", "belongsToMany"],
                            description: "Type of relation"
                        },
                        target: {
                            type: "string",
                            description: "Target table name",
                            example: "posts"
                        },
                        foreignKey: {
                            type: "string",
                            description: "Foreign key column name",
                            example: "user_id"
                        },
                        through: {
                            type: "string",
                            description: "Junction table name (for belongsToMany)",
                            example: "user_roles"
                        },
                        as: {
                            type: "string",
                            description: "Alias for the relation",
                            example: "author"
                        },
                        scope: {
                            type: "object",
                            description: "Additional conditions for the relation",
                            example: { "published": true }
                        },
                        onDelete: {
                            type: "string",
                            enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"],
                            description: "Action on delete"
                        },
                        onUpdate: {
                            type: "string",
                            enum: ["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"],
                            description: "Action on update"
                        }
                    },
                    required: ["type", "target"]
                },
                TableSchema: {
                    type: "object",
                    properties: {
                        table_name: { type: "string" },
                        columns: {
                            type: "array",
                            items: { $ref: "#/components/schemas/TableColumn" }
                        },
                        relations: {
                            type: "array",
                            items: { $ref: "#/components/schemas/TableRelation" }
                        }
                    },
                    required: ["table_name", "columns"]
                },
                HealthStatus: {
                    type: "object",
                    properties: {
                        status: {
                            type: "string",
                            enum: ["healthy", "degraded", "unhealthy"]
                        },
                        timestamp: { type: "number" },
                        uptime: { type: "number" },
                        version: { type: "string" },
                        databases: { type: "object" },
                        memory: { type: "object" }
                    }
                },
                User: {
                    type: "object",
                    properties: {
                        id: { type: "string" },
                        username: { type: "string" },
                        email: { type: "string" },
                        roles: {
                            type: "array",
                            items: { type: "string" }
                        },
                        permissions: {
                            type: "array",
                            items: { type: "string" }
                        },
                        created_at: { type: "string", format: "date-time" },
                        last_login: { type: "string", format: "date-time" }
                    }
                },
                LoginRequest: {
                    type: "object",
                    properties: {
                        username: {
                            type: "string",
                            description: "Username or email",
                            example: "admin"
                        },
                        password: {
                            type: "string",
                            description: "User password",
                            example: "password123"
                        }
                    },
                    required: ["username", "password"]
                },
                LoginResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        token: {
                            type: "string",
                            description: "JWT access token"
                        },
                        user: { $ref: "#/components/schemas/User" },
                        expires_in: {
                            type: "number",
                            description: "Token expiration time in seconds"
                        }
                    }
                },
                ConnectionRequest: {
                    type: "object",
                    properties: {
                        name: {
                            type: "string",
                            description: "Connection name",
                            example: "production_db"
                        },
                        config: { $ref: "#/components/schemas/DatabaseConfig" }
                    },
                    required: ["name", "config"]
                },
                ConnectionResponse: {
                    type: "object",
                    properties: {
                        success: { type: "boolean" },
                        name: { type: "string" },
                        connected: { type: "boolean" },
                        dialect: { type: "string" },
                        host: { type: "string" },
                        database: { type: "string" }
                    }
                }
            }
        },
        paths: {
            "/api/_database/connect": {
                post: {
                    summary: "Connect to a database",
                    description: "Establish a new database connection.",
                    tags: ["Database"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/ConnectionRequest"
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Database connected successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            database: { type: "string" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid configuration",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/": {
                get: {
                    summary: "Root endpoint",
                    description: "Welcome message and API information",
                    tags: ["General"],
                    responses: {
                        "200": {
                            description: "API information",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            message: { type: "string" },
                                            name: { type: "string" },
                                            version: { type: "string" },
                                            documentation: { type: "string" },
                                            health: { type: "string" },
                                            timestamp: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api": {
                get: {
                    summary: "API information",
                    description: "Get API status and available endpoints",
                    tags: ["General"],
                    responses: {
                        "200": {
                            description: "API status and endpoints",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            status: { type: "string" },
                                            uptime: { type: "number" },
                                            timestamp: { type: "number" },
                                            endpoints: {
                                                type: "object",
                                                properties: {
                                                    schema: { type: "string" },
                                                    database: { type: "string" },
                                                    relations: { type: "string" },
                                                    health: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema": {
                get: {
                    summary: "Schema operations",
                    description: "List available schema management operations",
                    tags: ["Schema"],
                    responses: {
                        "200": {
                            description: "Schema operations available",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            operations: { type: "array" },
                                            databases: { type: "array" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/databases": {
                get: {
                    summary: "List databases",
                    description: "Get all available databases for schema management",
                    tags: ["Schema"],
                    responses: {
                        "200": {
                            description: "List of databases",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            databases: { type: "array", items: { type: "string" } },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/{database}/tables": {
                get: {
                    summary: "List tables in database",
                    description: "Get all tables for a specific database",
                    tags: ["Schema"],
                    parameters: [
                        {
                            name: "database",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "List of tables",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            tables: { type: "array", items: { type: "string" } },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                },
                post: {
                    summary: "Create table in database",
                    description: "Create a new table in a specific database",
                    tags: ["Schema"],
                    parameters: [
                        {
                            name: "database",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TableSchema" }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Table created successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            table: { type: "string" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid schema",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/{database}/tables/{table}": {
                get: {
                    summary: "Describe table",
                    description: "Get schema for a specific table in a database",
                    tags: ["Schema"],
                    parameters: [
                        { name: "database", in: "path", required: true, schema: { type: "string" }, description: "Database name" },
                        { name: "table", in: "path", required: true, schema: { type: "string" }, description: "Table name" }
                    ],
                    responses: {
                        "200": {
                            description: "Table schema",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/TableSchema" }
                                }
                            }
                        },
                        "404": {
                            description: "Table or database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                },
                delete: {
                    summary: "Delete table",
                    description: "Delete a table from a database",
                    tags: ["Schema"],
                    parameters: [
                        { name: "database", in: "path", required: true, schema: { type: "string" }, description: "Database name" },
                        { name: "table", in: "path", required: true, schema: { type: "string" }, description: "Table name" }
                    ],
                    responses: {
                        "200": {
                            description: "Table deleted successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            table: { type: "string" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Table or database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/validate": {
                post: {
                    summary: "Validate table schema",
                    description: "Validate a table schema definition",
                    tags: ["Schema"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TableSchema" }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Validation result",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            valid: { type: "boolean" },
                                            errors: { type: "array", items: { type: "string" } },
                                            warnings: { type: "array", items: { type: "string" } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/types": {
                get: {
                    summary: "List supported types",
                    description: "Get all supported column types for table schemas",
                    tags: ["Schema"],
                    responses: {
                        "200": {
                            description: "Supported types",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            types: { type: "array", items: { type: "string" } }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database": {
                get: {
                    summary: "List all databases",
                    description: "Get all configured databases",
                    tags: ["Database"],
                    responses: {
                        "200": {
                            description: "List of databases",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            databases: { type: "array", items: { type: "string" } },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                },
                post: {
                    summary: "Connect to database",
                    description: "Connect to a new database",
                    tags: ["Database"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/DatabaseConfig" }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Database connected successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            database: { type: "string" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid configuration",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/health": {
                get: {
                    summary: "Database health",
                    description: "Get health status of all databases",
                    tags: ["Database"],
                    responses: {
                        "200": {
                            description: "Health status",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthStatus" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/{name}": {
                delete: {
                    summary: "Disconnect database",
                    description: "Disconnect and remove a database connection",
                    tags: ["Database"],
                    parameters: [
                        { name: "name", in: "path", required: true, schema: { type: "string" }, description: "Database name" }
                    ],
                    responses: {
                        "200": {
                            description: "Database disconnected",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                },
                get: {
                    summary: "Get database info",
                    description: "Get information about a specific database",
                    tags: ["Database"],
                    parameters: [
                        { name: "name", in: "path", required: true, schema: { type: "string" }, description: "Database name" }
                    ],
                    responses: {
                        "200": {
                            description: "Database info",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            dialect: { type: "string" },
                                            host: { type: "string" },
                                            port: { type: "number" },
                                            database: { type: "string" },
                                            user: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/{name}/info": {
                get: {
                    summary: "Get database info (alias)",
                    description: "Get information about a specific database (alias endpoint)",
                    tags: ["Database"],
                    parameters: [
                        { name: "name", in: "path", required: true, schema: { type: "string" }, description: "Database name" }
                    ],
                    responses: {
                        "200": {
                            description: "Database info",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            name: { type: "string" },
                                            dialect: { type: "string" },
                                            host: { type: "string" },
                                            port: { type: "number" },
                                            database: { type: "string" },
                                            user: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/config": {
                get: {
                    summary: "Get database config",
                    description: "Get configuration for all databases",
                    tags: ["Database"],
                    responses: {
                        "200": {
                            description: "Database config",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            configs: { type: "object" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/{database}/create-with-relations": {
                post: {
                    summary: "Create tables with relations",
                    description: "Create multiple tables and their relations in a database",
                    tags: ["Relations"],
                    parameters: [
                        { name: "database", in: "path", required: true, schema: { type: "string" }, description: "Database name" }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/TableSchema" }
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Tables and relations created successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            tables_created: { type: "number" },
                                            relations_created: { type: "number" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid schema or relations",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/{dbName}": {
                get: {
                    summary: "Get database schema",
                    description: "Retrieve schema information for a specific database",
                    tags: ["Schema"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Database schema information",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            database: { type: "string" },
                                            tables: { type: "array" },
                                            relations: { type: "array" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/{dbName}/create": {
                post: {
                    summary: "Create table from schema",
                    description: "Create a new table based on schema definition",
                    tags: ["Schema"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    $ref: "#/components/schemas/TableSchema",
                                    example: {
                                        table_name: "users",
                                        columns: [
                                            {
                                                name: "id",
                                                type: "integer",
                                                primary_key: true,
                                                auto_increment: true
                                            },
                                            {
                                                name: "email",
                                                type: "email",
                                                unique: true,
                                                nullable: false
                                            },
                                            {
                                                name: "name",
                                                type: "string",
                                                length: 100,
                                                nullable: false
                                            },
                                            {
                                                name: "created_at",
                                                type: "timestamp",
                                                default_value: "CURRENT_TIMESTAMP"
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Table created successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            table: { type: "string" },
                                            message: { type: "string" },
                                            columns_created: { type: "number" }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid schema",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "409": {
                            description: "Table already exists",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/{dbName}/validate": {
                post: {
                    summary: "Validate schema",
                    description: "Validate a table schema without creating it",
                    tags: ["Schema"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TableSchema" }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Schema validation result",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            valid: { type: "boolean" },
                                            errors: {
                                                type: "array",
                                                items: { type: "string" }
                                            },
                                            warnings: {
                                                type: "array",
                                                items: { type: "string" }
                                            },
                                            suggestions: {
                                                type: "array",
                                                items: { type: "string" }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_schema/convert": {
                post: {
                    summary: "Convert data types",
                    description: "Convert between different data type formats",
                    tags: ["Schema"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        from_type: {
                                            type: "string",
                                            description: "Source data type format",
                                            enum: ["sequelize", "mysql", "postgres", "sqlite", "json"]
                                        },
                                        to_type: {
                                            type: "string",
                                            description: "Target data type format",
                                            enum: ["sequelize", "mysql", "postgres", "sqlite", "json"]
                                        },
                                        schema: {
                                            description: "Schema to convert"
                                        }
                                    },
                                    required: ["from_type", "to_type", "schema"]
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Conversion result",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            converted_schema: { type: "object" },
                                            warnings: { type: "array" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/validate": {
                post: {
                    summary: "Validate relations",
                    description: "Validate table relations before creation",
                    tags: ["Relations"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/TableSchema" }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Relations validation result",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            valid: { type: "boolean" },
                                            errors: { type: "array" },
                                            warnings: { type: "array" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/{dbName}/establish": {
                post: {
                    summary: "Establish relations",
                    description: "Create relations between existing tables",
                    tags: ["Relations"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "array",
                                    items: { $ref: "#/components/schemas/TableSchema" }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Relations established successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            relations_created: { type: "number" },
                                            details: { type: "array" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/{dbName}/models": {
                get: {
                    summary: "Get models",
                    description: "Get all Sequelize models for a database",
                    tags: ["Relations"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "List of models",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            database: { type: "string" },
                                            models: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        attributes: { type: "object" },
                                                        associations: { type: "array" }
                                                    }
                                                }
                                            },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/{dbName}/{modelName}/associations": {
                get: {
                    summary: "Get model associations",
                    description: "Get all associations for a specific model",
                    tags: ["Relations"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        },
                        {
                            name: "modelName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Model name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Model associations",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            model: { type: "string" },
                                            associations: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        type: { type: "string" },
                                                        target: { type: "string" },
                                                        as: { type: "string" },
                                                        foreignKey: { type: "string" },
                                                        through: { type: "string" }
                                                    }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/auth/login": {
                post: {
                    summary: "User login",
                    description: "Authenticate user and get access token",
                    tags: ["Authentication"],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/LoginRequest" }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Login successful",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/LoginResponse" }
                                }
                            }
                        },
                        "401": {
                            description: "Invalid credentials",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "429": {
                            description: "Too many login attempts",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/auth/logout": {
                post: {
                    summary: "User logout",
                    description: "Invalidate user session",
                    tags: ["Authentication"],
                    security: [{ "bearerAuth": [] }],
                    responses: {
                        "200": {
                            description: "Logout successful",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "401": {
                            description: "Not authenticated",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/auth/me": {
                get: {
                    summary: "Get current user",
                    description: "Get information about the currently authenticated user",
                    tags: ["Authentication"],
                    security: [{ "bearerAuth": [] }],
                    responses: {
                        "200": {
                            description: "User information",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/User" }
                                }
                            }
                        },
                        "401": {
                            description: "Not authenticated",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/auth/refresh": {
                post: {
                    summary: "Refresh token",
                    description: "Refresh the access token",
                    tags: ["Authentication"],
                    security: [{ "bearerAuth": [] }],
                    responses: {
                        "200": {
                            description: "Token refreshed",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            token: { type: "string" },
                                            expires_in: { type: "number" }
                                        }
                                    }
                                }
                            }
                        },
                        "401": {
                            description: "Invalid or expired token",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/connect": {
                post: {
                    summary: "Add database connection",
                    description: "Add a new database connection to the system",
                    tags: ["Connection"],
                    security: [{ "bearerAuth": [] }],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ConnectionRequest" }
                            }
                        }
                    },
                    responses: {
                        "201": {
                            description: "Connection added successfully",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ConnectionResponse" }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid connection configuration",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "401": {
                            description: "Authentication required",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "403": {
                            description: "Insufficient permissions",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "409": {
                            description: "Connection name already exists",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/connect/{connectionName}": {
                get: {
                    summary: "Get connection info",
                    description: "Get information about a specific database connection",
                    tags: ["Connection"],
                    security: [{ "bearerAuth": [] }],
                    parameters: [
                        {
                            name: "connectionName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Connection name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Connection information",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/ConnectionResponse" }
                                }
                            }
                        },
                        "404": {
                            description: "Connection not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                },
                delete: {
                    summary: "Remove connection",
                    description: "Remove a database connection from the system",
                    tags: ["Connection"],
                    security: [{ "bearerAuth": [] }],
                    parameters: [
                        {
                            name: "connectionName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Connection name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "Connection removed successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            message: { type: "string" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Connection not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "403": {
                            description: "Insufficient permissions",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_relations/example": {
                get: {
                    summary: "Get relations example",
                    description: "Get a complete example of table schemas with relations",
                    tags: ["Relations"],
                    responses: {
                        "200": {
                            description: "Complete relations example",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            description: { type: "string" },
                                            schemas: {
                                                type: "array",
                                                items: { $ref: "#/components/schemas/TableSchema" }
                                            },
                                            usage: {
                                                type: "object",
                                                properties: {
                                                    create_endpoint: { type: "string" },
                                                    validate_endpoint: { type: "string" },
                                                    establish_endpoint: { type: "string" }
                                                }
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/list": {
                get: {
                    summary: "List databases",
                    description: "Get list of all available databases",
                    tags: ["Database"],
                    responses: {
                        "200": {
                            description: "List of databases",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            databases: {
                                                type: "array",
                                                items: { type: "string" }
                                            },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/{dbName}/query": {
                post: {
                    summary: "Execute query",
                    description: "Execute a SQL query on a specific database",
                    tags: ["Database"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        required: true,
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        query: {
                                            type: "string",
                                            description: "SQL query to execute",
                                            example: "SELECT * FROM users WHERE active = true"
                                        },
                                        params: {
                                            type: "array",
                                            description: "Query parameters for prepared statements",
                                            items: { type: "string" },
                                            example: ["value1", "value2"]
                                        }
                                    },
                                    required: ["query"]
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Query executed successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            results: {
                                                type: "array",
                                                description: "Query results"
                                            },
                                            rowsAffected: {
                                                type: "number",
                                                description: "Number of rows affected by the query"
                                            },
                                            executionTime: {
                                                type: "number",
                                                description: "Query execution time in milliseconds"
                                            }
                                        }
                                    }
                                }
                            }
                        },
                        "400": {
                            description: "Invalid query",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/{dbName}/tables": {
                get: {
                    summary: "List tables",
                    description: "Get list of all tables in a database",
                    tags: ["Database"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    responses: {
                        "200": {
                            description: "List of tables",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            database: { type: "string" },
                                            tables: {
                                                type: "array",
                                                items: {
                                                    type: "object",
                                                    properties: {
                                                        name: { type: "string" },
                                                        columns: { type: "number" },
                                                        rows: { type: "number" }
                                                    }
                                                }
                                            },
                                            count: { type: "number" }
                                        }
                                    }
                                }
                            }
                        },
                        "404": {
                            description: "Database not found",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/Error" }
                                }
                            }
                        }
                    }
                }
            },
            "/api/_database/{dbName}/backup": {
                post: {
                    summary: "Create backup",
                    description: "Create a backup of the database",
                    tags: ["Database"],
                    parameters: [
                        {
                            name: "dbName",
                            in: "path",
                            required: true,
                            schema: { type: "string" },
                            description: "Database name"
                        }
                    ],
                    requestBody: {
                        content: {
                            "application/json": {
                                schema: {
                                    type: "object",
                                    properties: {
                                        filename: {
                                            type: "string",
                                            description: "Custom backup filename (optional)"
                                        },
                                        compression: {
                                            type: "boolean",
                                            description: "Compress backup file",
                                            default: true
                                        }
                                    }
                                }
                            }
                        }
                    },
                    responses: {
                        "200": {
                            description: "Backup created successfully",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            success: { type: "boolean" },
                                            filename: { type: "string" },
                                            size: { type: "number" },
                                            timestamp: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            },
            "/health": {
                get: {
                    summary: "Health check",
                    description: "Check API and database health status",
                    tags: ["Monitoring"],
                    responses: {
                        "200": {
                            description: "Service is healthy",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthStatus" }
                                }
                            }
                        },
                        "503": {
                            description: "Service is degraded or unhealthy",
                            content: {
                                "application/json": {
                                    schema: { $ref: "#/components/schemas/HealthStatus" }
                                }
                            }
                        }
                    }
                }
            },
            "/metrics": {
                get: {
                    summary: "System metrics",
                    description: "Get system performance metrics",
                    tags: ["Monitoring"],
                    responses: {
                        "200": {
                            description: "System metrics",
                            content: {
                                "application/json": {
                                    schema: {
                                        type: "object",
                                        properties: {
                                            system: {
                                                type: "object",
                                                properties: {
                                                    uptime: { type: "number" },
                                                    memory: {
                                                        type: "object",
                                                        properties: {
                                                            used: { type: "number" },
                                                            total: { type: "number" },
                                                            external: { type: "number" }
                                                        }
                                                    },
                                                    databases: {
                                                        type: "object",
                                                        properties: {
                                                            total: { type: "number" },
                                                            healthy: { type: "number" }
                                                        }
                                                    }
                                                }
                                            },
                                            environment: { type: "string" },
                                            timestamp: { type: "number" }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        },
        tags: [
            {
                name: "General",
                description: "General API endpoints"
            },
            {
                name: "Authentication",
                description: "User authentication and authorization"
            },
            {
                name: "Connection",
                description: "Database connection management"
            },
            {
                name: "Schema",
                description: "Database schema management"
            },
            {
                name: "Database",
                description: "Database operations"
            },
            {
                name: "Relations",
                description: "Table relations management"
            },
            {
                name: "Monitoring",
                description: "Health and metrics endpoints"
            }
        ]
    };
};
