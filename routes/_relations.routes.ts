import { Hono } from "hono";
import { DatabaseManager } from "../middlewares/databaseManager";
import { SchemaConverter, TableSchema } from "../utils/convert";
import Logging from "../utils/logging";

const _relations = new Hono();
const logger = Logging.getInstance('RelationsRoutes');
const dbManager = DatabaseManager.getInstance();

// Middleware pour vérifier la connexion à la base de données
_relations.use('*', async (c, next) => {
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

// GET /api/_relations - Informations sur les relations
_relations.get("/", (c) => {
    return c.json({
        message: "Relations endpoint is active",
        timestamp: Date.now(),
        supported_relations: [
            {
                type: 'hasOne',
                description: 'One-to-one relationship where the foreign key is in the target table',
                example: 'User hasOne Profile'
            },
            {
                type: 'hasMany',
                description: 'One-to-many relationship where the foreign key is in the target table',
                example: 'User hasMany Posts'
            },
            {
                type: 'belongsTo',
                description: 'Many-to-one relationship where the foreign key is in the source table',
                example: 'Post belongsTo User'
            },
            {
                type: 'belongsToMany',
                description: 'Many-to-many relationship using a junction table',
                example: 'User belongsToMany Roles through UserRoles'
            }
        ]
    });
});

// POST /api/_relations/:database/establish - Établir des relations entre tables existantes
_relations.post("/:database/establish", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const schemas: TableSchema[] = await c.req.json();

        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        // Valider les relations
        const converter = new SchemaConverter({ strictValidation: true });
        const validation = converter.validateRelations(schemas);

        if (!validation.valid) {
            return c.json({
                error: 'Relations validation failed',
                errors: validation.errors
            }, 400);
        }

        // Établir les relations
        const models = converter.establishRelations(schemas, sequelize);

        logger.info(`Relations established for ${Object.keys(models).length} models in database '${databaseName}'`);

        return c.json({
            message: 'Relations established successfully',
            database: databaseName,
            models: Object.keys(models),
            relations_count: schemas.reduce((count, schema) => count + (schema.relations?.length || 0), 0)
        });

    } catch (error) {
        logger.error('Error establishing relations:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        return c.json({
            error: 'Failed to establish relations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// POST /api/_relations/:database/create-with-relations - Créer tables avec relations
_relations.post("/:database/create-with-relations", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const schemas: TableSchema[] = await c.req.json();

        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        // Valider tous les schémas et relations
        const converter = new SchemaConverter({ strictValidation: true, autoAssociate: true });

        // Valider chaque schéma individuellement
        for (const schema of schemas) {
            const schemaValidation = converter.validateSchema(schema);
            if (!schemaValidation.valid) {
                return c.json({
                    error: `Schema validation failed for table '${schema.table_name}'`,
                    errors: schemaValidation.errors
                }, 400);
            }
        }

        // Valider les relations
        const relationsValidation = converter.validateRelations(schemas);
        if (!relationsValidation.valid) {
            return c.json({
                error: 'Relations validation failed',
                errors: relationsValidation.errors
            }, 400);
        }

        // Créer les tables avec relations
        const models = converter.establishRelations(schemas, sequelize);

        // Synchroniser toutes les tables
        await sequelize.sync({ force: false });

        logger.info(`Created ${schemas.length} tables with relations in database '${databaseName}'`);

        return c.json({
            message: 'Tables and relations created successfully',
            database: databaseName,
            tables: schemas.map(s => s.table_name),
            models: Object.keys(models),
            relations_count: schemas.reduce((count, schema) => count + (schema.relations?.length || 0), 0)
        }, 201);

    } catch (error) {
        logger.error('Error creating tables with relations:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        return c.json({
            error: 'Failed to create tables with relations',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, 500);
    }
});

// POST /api/_relations/validate - Valider des relations sans les créer
_relations.post("/validate", async (c) => {
    try {
        const schemas: TableSchema[] = await c.req.json();

        const converter = new SchemaConverter({ strictValidation: true });
        const validation = converter.validateRelations(schemas);

        return c.json({
            valid: validation.valid,
            errors: validation.errors,
            summary: {
                tables_count: schemas.length,
                relations_count: schemas.reduce((count, schema) => count + (schema.relations?.length || 0), 0),
                relation_types: schemas.flatMap(s => s.relations || []).reduce((types: any, rel) => {
                    types[rel.type] = (types[rel.type] || 0) + 1;
                    return types;
                }, {})
            }
        });

    } catch (error) {
        logger.error('Error validating relations:', error);
        return c.json({ error: 'Invalid JSON schemas' }, 400);
    }
});

// GET /api/_relations/example - Exemple complet de schémas avec relations
_relations.get("/example", (c) => {
    const exampleSchemas = SchemaConverter.generateRelationExample();

    return c.json({
        message: "Complete example of schemas with relations",
        description: "This example shows a blog system with users, posts, categories, tags, and roles",
        schemas: exampleSchemas,
        usage: {
            create: "POST /api/_relations/:database/create-with-relations",
            establish: "POST /api/_relations/:database/establish",
            validate: "POST /api/_relations/validate"
        }
    });
});

// GET /api/_relations/:database/models - Liste les modèles et leurs relations
_relations.get("/:database/models", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        const models = sequelize.models;
        const modelInfo: any = {};

        Object.keys(models).forEach(modelName => {
            const model = models[modelName];
            const associations = model.associations;

            modelInfo[modelName] = {
                tableName: model.tableName,
                attributes: Object.keys(model.rawAttributes),
                associations: Object.keys(associations).map(assocName => {
                    const assoc = associations[assocName];
                    return {
                        name: assocName,
                        type: assoc.associationType,
                        target: assoc.target.name,
                        foreignKey: assoc.foreignKey,
                        source: (assoc as any).source?.name,
                        through: (assoc as any).through ? (assoc as any).through.model.name : undefined
                    };
                })
            };
        });

        return c.json({
            database: databaseName,
            models: modelInfo,
            total_models: Object.keys(models).length,
            total_associations: Object.values(modelInfo).reduce((count: number, model: any) =>
                count + model.associations.length, 0)
        });

    } catch (error) {
        logger.error('Error getting models info:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        return c.json({ error: 'Failed to get models information' }, 500);
    }
});

// GET /api/_relations/:database/:model/associations - Relations d'un modèle spécifique
_relations.get("/:database/:model/associations", async (c) => {
    try {
        const databaseName = c.req.param('database');
        const modelName = c.req.param('model');

        const database = dbManager.getDatabase(databaseName);
        const sequelize = database.getConnection();

        const model = sequelize.models[modelName];
        if (!model) {
            return c.json({
                error: `Model '${modelName}' not found`,
                available_models: Object.keys(sequelize.models)
            }, 404);
        }

        const associations = model.associations;
        const associationDetails = Object.keys(associations).map(assocName => {
            const assoc = associations[assocName];
            return {
                name: assocName,
                type: assoc.associationType,
                target: {
                    model: assoc.target.name,
                    table: assoc.target.tableName
                },
                keys: {
                    foreign: assoc.foreignKey,
                    source: (assoc as any).source?.name,
                    target: assoc.target.name
                },
                through: (assoc as any).through ? {
                    model: (assoc as any).through.model.name,
                    table: (assoc as any).through.model.tableName
                } : undefined,
                options: {
                    as: assoc.as,
                    onDelete: (assoc as any).onDelete,
                    onUpdate: (assoc as any).onUpdate
                }
            };
        });

        return c.json({
            database: databaseName,
            model: {
                name: modelName,
                table: model.tableName
            },
            associations: associationDetails,
            total_associations: associationDetails.length
        });

    } catch (error) {
        logger.error('Error getting model associations:', error);
        if (error instanceof Error && error.message.includes('not found')) {
            return c.json({ error: 'Database not found' }, 404);
        }
        return c.json({ error: 'Failed to get model associations' }, 500);
    }
});

export default _relations;
