import { Hono } from "hono";
import { DatabaseManager } from "../middlewares/database";
import Logging from "../utils/logging";
import ConfigManager from "../managers/ConfigManager";
import { DatabaseConfig } from "../utils/types";
import configManager from "../managers/ConfigManager";

const _database = new Hono();
const logger = Logging.getInstance('DatabaseRoutes');
const dbManager = DatabaseManager.getInstance();

// Middleware pour logging des requêtes
_database.use('*', async (c, next) => {
    const start = Date.now();
    await next();
    const duration = Date.now() - start;
    logger.debug(`${c.req.method} ${c.req.path} - ${c.res.status} (${duration}ms)`);
});

// GET /api/_database - Status général des bases de données
_database.get("/", (c) => {
    try {
        const dbNames = dbManager.getDatabaseNames();
        const healthStatus = dbManager.getHealthStatus();

        return c.json({
            message: "Database endpoint is active",
            timestamp: Date.now(),
            total_databases: dbNames.length,
            databases: dbNames.map(name => ({
                name,
                status: healthStatus[name] ? 'healthy' : 'unhealthy',
                type: dbManager.getDatabase(name).getConfig().dialect,
            })),
            overall_health: Object.values(healthStatus).every(status => status)
        });
    } catch (error) {
        logger.error('Error in database root endpoint:', error);
        return c.json({ error: 'Internal server error' }, 500);
    }
});

// GET /api/_database/health - Health check détaillé
_database.get("/health", async (c) => {
    try {
        const dbNames = dbManager.getDatabaseNames();
        const healthDetails: any = {};

        for (const name of dbNames) { 
            try {
                const database = dbManager.getDatabase(name);
                const sequelize = database.getConnection();

                // Test de connexion simple
                const startTime = Date.now();
                await sequelize.authenticate();
                const responseTime = Date.now() - startTime;

                healthDetails[name] = {
                    status: database.isHealthy() ? 'healthy' : 'unhealthy',
                    response_time_ms: responseTime,
                    dialect: dbManager.getDatabase(name).getConfig().dialect,
                    last_checked: new Date().toISOString()
                };
            } catch (error) {
                healthDetails[name] = {
                    status: 'unhealthy',
                    error: error instanceof Error ? error.message : 'Unknown error',
                    last_checked: new Date().toISOString()
                };
            }
        }

        const isHealthy = Object.values(healthDetails).every((db: any) => db.status === 'healthy');

        return c.json({
            overall_status: isHealthy ? 'healthy' : 'degraded',
            timestamp: Date.now(),
            databases: healthDetails
        }, isHealthy ? 200 : 503);

    } catch (error) {
        logger.error('Error in health check:', error);
        return c.json({
            overall_status: 'unhealthy',
            error: 'Health check failed',
            timestamp: Date.now()
        }, 503);
    }
});

// POST /api/_database/:dbName - Connecter une nouvelle base de données
_database.post("/:dbName", async (c) => {
    try {
        const name = c.req.param('dbName');
        const body = await c.req.json();
        const config: DatabaseConfig = body;

        if (!name || !config) {
            return c.json({
                error: 'Name and config are required',
                required_fields: ['name', 'config']
            }, 400);
        }

        // Valider la configuration
        const requiredFields = ['host', 'port', 'user', 'password', 'database', 'dialect'];
        const missingFields = requiredFields.filter(field => {
            if (config.dialect === 'sqlite') {
                return field === 'dialect' && !config[field as keyof DatabaseConfig];
            }
            return !config[field as keyof DatabaseConfig];
        });

        if (missingFields.length > 0) {
            return c.json({
                error: 'Missing required configuration fields',
                missing_fields: missingFields
            }, 400);
        }

        // Vérifier si la base de données existe déjà
        if (dbManager.getDatabaseNames().includes(name)) {
            await dbManager.addDatabase(name, config);
            return c.json({
                error: `Database '${name}' already exists and updated successfully`,
                existing_databases: dbManager.getDatabaseNames()
            }, 409);
        }

        // Tenter la connexion
        await dbManager.addDatabase(name, config);

        logger.info(`Database '${name}' connected successfully`);

        return c.json({
            message: `Database '${name}' connected successfully`,
            database: {
                name,
                dialect: config.dialect,
                status: 'connected'
            }
        }, 201);

    } catch (error) {
        logger.error('Error connecting database:', error);
        return c.json({
            error: 'Failed to connect database',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// DELETE /api/_database/:name - Déconnecter une base de données
_database.delete("/:name", async (c) => {
    try {
        const name = c.req.param('name');

        if (!dbManager.getDatabaseNames().includes(name)) {
            return c.json({
                error: `Database '${name}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }

        if (name === 'primary') {
            return c.json({
                error: 'Cannot disconnect primary database',
                hint: 'Primary database is required for system operation'
            }, 403);
        }

        await dbManager.removeDatabase(name);

        logger.info(`Database '${name}' disconnected successfully`);

        return c.json({
            message: `Database '${name}' disconnected successfully`,
            remaining_databases: dbManager.getDatabaseNames()
        });

    } catch (error) {
        logger.error('Error disconnecting database:', error);
        return c.json({
            error: 'Failed to disconnect database',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// GET /api/_database/:name/info - Informations détaillées sur une base de données
_database.get("/:name/info", async (c) => {
    try {
        const name = c.req.param('name');

        if (!dbManager.getDatabaseNames().includes(name)) {
            return c.json({
                error: `Database '${name}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }

        const database = dbManager.getDatabase(name);
        const sequelize = database.getConnection();
        const config = database.getConfig();

        // Obtenir des informations sur la base de données
        const tables = await sequelize.getQueryInterface().showAllTables();

        // Informations de version (si possible)
        let version = 'Unknown';
        try {
            const [results] = await sequelize.query('SELECT VERSION() as version');
            if (Array.isArray(results) && results.length > 0) {
                version = (results[0] as any).version;
            }
        } catch {
            // Ignore l'erreur de version, pas critique
        }

        return c.json({
            database: {
                name,
                dialect: config.dialect,
                host: config.dialect !== 'sqlite' ? config.host : 'file',
                database: config.database,
                status: database.isHealthy() ? 'connected' : 'disconnected',
                version,
                table_count: tables.length,
                tables: tables.map(table => ({ name: table, type: 'table' }))
            }
        });

    } catch (error) {
        logger.error('Error getting database info:', error);
        return c.json({
            error: 'Failed to get database information',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// GET /api/_database/:database/get/:table - Récupérer des données d'une table (sans SQL brut)
_database.post('/:database/get/:table', async (c) => {
    try {
        const dbName = c.req.param('database');
        const table = c.req.param('table');
        const body = await c.req.json();
        const { columns, where, include, limit, offset, order } = body || {};

        if (!dbManager.getDatabaseNames().includes(dbName)) {
            return c.json({
                error: `Database '${dbName}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }

        const database = dbManager.getDatabase(dbName);
        const sequelize = database.getConnection();
        const models = sequelize.models;
        const model = models[table];
        if (!model) {
            return c.json({
                error: `Table/model '${table}' not found in database '${dbName}'`,
                available_tables: Object.keys(models)
            }, 404);
        }

        // Construction de l'option Sequelize
        const options: any = {};
        let attributes: string[] = [];
        let dynamicInclude: any[] = [];

        if (columns && Array.isArray(columns)) {
            for (const col of columns) {
                if (typeof col === 'string' && col.includes('.')) {
                    const [relation, relCol] = col.split('.');
                    // Résolution du nom d'association réel
                    let assocName = relation;
                    if (!model.associations[relation]) {
                        // Cherche une association dont le modèle cible correspond
                        const found = Object.entries(model.associations).find(([key, assoc]) => {
                            return assoc.target && assoc.target.name && assoc.target.name.toLowerCase() === relation.toLowerCase();
                        });
                        if (found) assocName = found[0];
                    }
                    // Cherche si déjà dans include
                    let inc = dynamicInclude.find(i => i.association === assocName || i.model?.name === assocName);
                    if (!inc) {
                        inc = { association: assocName, attributes: [relCol] };
                        dynamicInclude.push(inc);
                    } else {
                        if (!inc.attributes.includes(relCol)) inc.attributes.push(relCol);
                    }
                } else {
                    attributes.push(col);
                }
            }
            if (attributes.length > 0) options.attributes = attributes;
            if (dynamicInclude.length > 0) options.include = dynamicInclude;
        }

        if (where && typeof where === 'object') {
            // Nettoyer les clés dont la valeur est un objet vide
            options.where = Object.fromEntries(
                Object.entries(where).filter(([_, v]) => {
                    if (typeof v === 'object' && v !== null && Object.keys(v).length === 0) return false;
                    return true;
                })
            );
        }

        if (include && Array.isArray(include)) {
            options.include = (options.include || []).concat(include);
        }
        if (typeof limit === 'number') options.limit = limit;
        if (typeof offset === 'number') options.offset = offset;
        if (order) options.order = order;

        const results = await model.findAll(options);

        return c.json({
            database: dbName,
            table,
            count: results.length,
            results
        });
    } catch (error) {
        logger.error('Error in get-table endpoint:', error);
        return c.json({
            error: 'Failed to fetch data',
            details: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check table name, columns, and relations.'
        }, 500);
    }
});


// UPDATE /api/_database/:database/update/:table - Mettre à jour des données dans une table
_database.put('/:database/update/:table', async (c) => {
    try {
        const dbName = c.req.param('database');
        const table = c.req.param('table');
        const body = await c.req.json();
        const { where, data } = body || {};
        if (!dbManager.getDatabaseNames().includes(dbName)) {
            return c.json({
                error: `Database '${dbName}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }
        const database = dbManager.getDatabase(dbName);
        const sequelize = database.getConnection();
        const models = sequelize.models;
        const model = models[table];
        if (!model) {
            return c.json({
                error: `Table/model '${table}' not found in database '${dbName}'`,
                available_tables: Object.keys(models)
            }, 404);
        }
        if (!where || typeof where !== 'object' || Object.keys(where).length === 0) {
            return c.json({
                error: 'Where clause is required for update',
                hint: 'Provide a valid where clause to identify records to update'
            }, 400);
        }
        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return c.json({
                error: 'Data to update is required',
                hint: 'Provide valid data to update the records'
            }, 400);
        }
        // Nettoyer les clés dont la valeur est un objet vide
        const cleanedWhere = Object.fromEntries(
            Object.entries(where).filter(([_, v]) => {
                if (typeof v === 'object' && v !== null && Object.keys(v).length
                    === 0) return false;
                return true;
            })
        );
        const [count] = await model.update(data, {
            where: cleanedWhere
        });
        if (count === 0) {
            return c.json({
                message: 'No records updated',
                count: 0
            }, 404);
        }
        return c.json({
            message: `${count} record(s) updated successfully in '${table}'`,
            database: dbName,
            table,
            updated_count: count
        });
    } catch (error) {
        logger.error('Error in update-table endpoint:', error);
        return c.json({
            error: 'Failed to update data',
            details: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check table name, where clause, and data format.'
        }, 500);
    }
});

_database.post('/:database/insert/:table', async (c) => {
    try {
        const dbName = c.req.param('database');
        const table = c.req.param('table');
        const body = await c.req.json();
        const { data } = body || {};
        if (!dbManager.getDatabaseNames().includes(dbName)) {
            return c.json({
                error: `Database '${dbName}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }
        const database = dbManager.getDatabase(dbName);
        const sequelize = database.getConnection();
        const models = sequelize.models;
        const model = models[table];
        if (!model) {
            return c.json({
                error: `Table/model '${table}' not found in database '${dbName}'`,
                available_tables: Object.keys(models)
            }, 404);
        }

        if (!data || typeof data !== 'object' || Object.keys(data).length === 0) {
            return c.json({
                error: 'Data to insert is required',
                hint: 'Provide valid data to insert into the table'
            }, 400);
        }

        // Nettoyer les clés dont la valeur est un objet vide
        const cleanedData = Object.fromEntries(
            Object.entries(data).filter(([_, v]) => {
                if (typeof v === 'object' && v !== null && Object.keys(v).length
                    === 0) return false;
                return true;
            })
        );
        const result = await model.create(cleanedData);
        return c.json({
            message: 'Record inserted successfully',
            database: dbName,
            table,
            record: result
        }, 201);
    } catch (error) {
        logger.error('Error in insert-table endpoint:', error);
        return c.json({
            error: 'Failed to insert data',
            details: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check table name and data format.'
        }, 500);
    }
});

// DELETE /api/_database/:database/delete/:table - Supprimer des données d'une table
_database.delete('/:database/delete/:table', async (c) => {
    try {
        const dbName = c.req.param('database');
        const table = c.req.param('table');
        const body = await c.req.json();
        const { where } = body || {};

        if (!dbManager.getDatabaseNames().includes(dbName)) {
            return c.json({
                error: `Database '${dbName}' not found`,
                available_databases: dbManager.getDatabaseNames()
            }, 404);
        }

        const database = dbManager.getDatabase(dbName);
        const sequelize = database.getConnection();
        const models = sequelize.models;
        const model = models[table];
        if (!model) {
            return c.json({
                error: `Table/model '${table}' not found in database '${dbName}'`,
                available_tables: Object.keys(models)
            }, 404);
        }
        if (!where || typeof where !== 'object' || Object.keys(where).length === 0) {
            return c.json({
                error: 'Where clause is required for delete',
                hint: 'Provide a valid where clause to identify records to delete'
            }, 400);
        }
        // Nettoyer les clés dont la valeur est un objet vide
        const cleanedWhere = Object.fromEntries(
            Object.entries(where).filter(([_, v]) => {
                if (typeof v === 'object' && v !== null && Object.keys(v).length
                    === 0) return false;
                return true;
            })
        );
        const count = await model.destroy({
            where: cleanedWhere
        });
        if (count === 0) {
            return c.json({
                message: 'No records deleted',
                count: 0
            }, 404);
        }
        return c.json({
            message: `${count} record(s) deleted successfully from '${table}'`,
            database: dbName,
            table,
            deleted_count: count
        });
    } catch (error) {
        logger.error('Error in delete-table endpoint:', error);
        return c.json({
            error: 'Failed to delete data',
            details: error instanceof Error ? error.message : 'Unknown error',
            hint: 'Check table name and where clause.'
        }, 500);
    }
});

// GET /api/_database/config - Configuration des bases de données disponibles
_database.get("/config", (c) => {
    try {
        const configs = dbManager.getDatabaseNames().map(name => {
            const config = dbManager.getDatabase(name).getConfig();
            return {
                name,
                dialect: config.dialect,
                host: config.dialect !== 'sqlite' ? config.host : 'file',
                database: config.database,
                // Ne pas exposer les credentials
                has_credentials: !!(config.user && config.password)
            };
        });

        return c.json({
            databases: configs,
            total: configs.length
        });

    } catch (error) {
        logger.error('Error getting database config:', error);
        return c.json({ error: 'Failed to get database configuration' }, 500);
    }
});

export default _database;