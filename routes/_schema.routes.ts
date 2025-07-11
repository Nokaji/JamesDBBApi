import { Hono } from "hono";
import { DatabaseManager } from "../middlewares/databaseManager";
import { SchemaConverter, TableSchema } from "../utils/convert";
import Logging from "../utils/logging";
import ConfigManager from "../managers/ConfigManager";

const _schema = new Hono();
const logger = Logging.getInstance('SchemaRoutes');
const dbManager = DatabaseManager.getInstance();

// Middleware pour vérifier la connexion à la base de données
_schema.use('*', async (c, next) => {
    try {
        const dbNames = dbManager.getDatabaseNames();
        if (dbNames.length === 0) {
            return c.json({ error: 'No database connections available' }, 503);
        }
        await next();
    } catch (error) {
        logger.error('Database middleware error:', error);
        return c.json({ error: 'Database service unavailable' }, 503);
    }
});

// GET /api/_schema - Liste tous les schémas disponibles
_schema.get("/", (c) => {
    try {
        const dbNames = dbManager.getDatabaseNames();
        const healthStatus = dbManager.getHealthStatus();

        return c.json({
            message: "Schema endpoint is active",
            timestamp: Date.now(),
            databases: dbNames.map(name => ({
                name,
                healthy: healthStatus[name],
                status: healthStatus[name] ? 'connected' : 'disconnected'
            })),
            available_types: SchemaConverter.getAvailableTypes()
        });
    } catch (error) {
        logger.error('Error in schema root endpoint:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// GET /api/_schema/databases - Liste toutes les bases de données
_schema.get("/databases", (c) => {
    try {
        const dbNames = dbManager.getDatabaseNames();
        const healthStatus = dbManager.getHealthStatus();

        return c.json({
            databases: dbNames.map(name => ({
                name,
                healthy: healthStatus[name],
                config: dbManager.getDatabase(name).getConfig()
            }))
        });
    } catch (error) {
        logger.error('Error listing databases:', error);
        return c.json({ error: 'Failed to list databases' }, 500);
    }
});

// GET /api/_schema/:database/tables - Liste les tables d'une base de données
_schema.get("/:database/tables", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        const tables = await sequelize.getQueryInterface().showAllTables();

        return c.json({
            database: databaseName,
            tables: tables.map(table => ({
                name: table,
                type: 'table'
            }))
        });
    } catch (error) {
        logger.error('Error listing tables:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        return c.json({ error: 'Failed to list tables' }, 500);
    }
});

// GET /api/_schema/:database/tables/:table - Décrit une table spécifique
_schema.get("/:database/tables/:table", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const tableName = c.req.param('table');
        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        const queryInterface = sequelize.getQueryInterface();
        const attributes = await queryInterface.describeTable(tableName);
        const indexes = await queryInterface.showIndex(tableName);

        return c.json({
            database: databaseName,
            table: tableName,
            columns: Object.entries(attributes).map(([name, attr]: [string, any]) => ({
                name,
                type: attr.type,
                allowNull: attr.allowNull,
                defaultValue: attr.defaultValue,
                primaryKey: attr.primaryKey || false,
                autoIncrement: attr.autoIncrement || false,
                unique: attr.unique || false
            })),
            indexes: Array.isArray(indexes) ? indexes.map((index: any) => ({
                name: index.name,
                columns: index.fields.map((field: any) => field.attribute),
                unique: index.unique,
                primary: index.primary
            })) : []
        });
    } catch (error) {
        logger.error('Error describing table:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database or table not found' }, 404);
        }
        return c.json({ error: 'Failed to describe table' }, 500);
    }
});

// POST /api/_schema/:database/tables - Crée une nouvelle table
_schema.post("/:database/tables", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const schema: TableSchema = await c.req.json();

        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        // Valider le schéma
        const converter = new SchemaConverter({ strictValidation: true });
        const validation = converter.validateSchema(schema);

        if (!validation.valid) {
            return c.json({
                error: 'Schema validation failed',
                errors: validation.errors
            }, 400);
        }

        // Créer le modèle et synchroniser
        const model = converter.convertToSequelize(schema, sequelize);
        await model.sync({ force: false });

        logger.info(`Table '${schema.table_name}' created in database '${databaseName}'`);

        return c.json({
            message: `Table '${schema.table_name}' created successfully`,
            database: databaseName,
            table: schema.table_name,
            columns: schema.columns.length
        }, 201);

    } catch (error) {
        logger.error('Error creating table:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        if (error instanceof Error && error.message.includes('already exists')) {
            return c.json({ error: 'Table already exists' }, 409);
        }
        return c.json({ error: 'Failed to create table' }, 500);
    }
});

// DELETE /api/_schema/:database/tables/:table - Supprime une table
_schema.delete("/:database/tables/:table", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const tableName = c.req.param('table');
        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        await sequelize.getQueryInterface().dropTable(tableName);

        logger.info(`Table '${tableName}' dropped from database '${databaseName}'`);

        return c.json({
            message: `Table '${tableName}' deleted successfully`,
            database: databaseName,
            table: tableName
        });

    } catch (error) {
        logger.error('Error dropping table:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database or table not found' }, 404);
        }
        return c.json({ error: 'Failed to delete table' }, 500);
    }
});

// POST /api/_schema/validate - Valide un schéma sans le créer
_schema.post("/validate", async (c) => {
    try {
        const schema: TableSchema = await c.req.json();

        const converter = new SchemaConverter({ strictValidation: true });
        const validation = converter.validateSchema(schema);

        return c.json({
            valid: validation.valid,
            errors: validation.errors,
            schema: {
                table_name: schema.table_name,
                columns_count: schema.columns?.length || 0,
                indexes_count: schema.indexes?.length || 0
            }
        });

    } catch (error) {
        logger.error('Error validating schema:', error);
        return c.json({ error: 'Invalid JSON schema' }, 400);
    }
});

// GET /api/_schema/types - Liste tous les types de données supportés
_schema.get("/types", (c) => {
    return c.json({
        types: SchemaConverter.getAvailableTypes(),
        description: "Available data types for schema conversion"
    });
});

export default _schema;