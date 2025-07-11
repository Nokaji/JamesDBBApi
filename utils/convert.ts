import { DataTypes, Sequelize, ModelAttributeColumnOptions } from 'sequelize';

interface Column {
    name: string;
    type: string;
    primary_key?: boolean;
    nullable?: boolean;
    default_value?: any;
    unique?: boolean;
    auto_increment?: boolean;
    length?: number;
    precision?: number;
    scale?: number;
    foreign_key?: {
        table: string;
        column: string;
        on_delete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
        on_update?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    };
    index?: boolean;
    comment?: string;
    validate?: {
        [key: string]: any;
    };
}

interface TableRelation {
    type: 'hasOne' | 'hasMany' | 'belongsTo' | 'belongsToMany';
    target: string; // Target table name
    foreignKey?: string; // Foreign key in this table
    targetKey?: string; // Target key in target table
    through?: string; // Junction table for many-to-many
    as?: string; // Alias for the association
    onDelete?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    onUpdate?: 'CASCADE' | 'SET NULL' | 'RESTRICT' | 'NO ACTION';
    constraints?: boolean;
    scope?: { [key: string]: any }; // Additional scope conditions
}

interface TableSchema {
    table_name: string;
    columns: Column[];
    relations?: TableRelation[];
    indexes?: {
        name: string;
        columns: string[];
        unique?: boolean;
        type?: 'BTREE' | 'HASH' | 'GIST' | 'SPGIST' | 'GIN' | 'BRIN';
    }[];
    constraints?: {
        name: string;
        type: 'CHECK' | 'UNIQUE' | 'FOREIGN_KEY';
        columns: string[];
        reference?: {
            table: string;
            columns: string[];
        };
        condition?: string;
    }[];
}

interface ConversionOptions {
    strictValidation?: boolean;
    addTimestamps?: boolean;
    paranoid?: boolean;
    underscored?: boolean;
    freezeTableName?: boolean;
    autoAssociate?: boolean; // Automatically create associations
}

interface ModelRegistry {
    [tableName: string]: any; // Sequelize Model
}

class SchemaConverter {
    private typeMapping: { [key: string]: any } = {
        // Numeric types
        'integer': DataTypes.INTEGER,
        'int': DataTypes.INTEGER,
        'smallint': DataTypes.SMALLINT,
        'bigint': DataTypes.BIGINT,
        'float': DataTypes.FLOAT,
        'double': DataTypes.DOUBLE,
        'decimal': DataTypes.DECIMAL,
        'numeric': DataTypes.DECIMAL,
        'real': DataTypes.REAL,

        // String types
        'string': DataTypes.STRING,
        'varchar': DataTypes.STRING,
        'char': DataTypes.CHAR,
        'text': DataTypes.TEXT,
        'mediumtext': DataTypes.TEXT,
        'longtext': DataTypes.TEXT,
        'tinytext': DataTypes.STRING(255),

        // Date/Time types
        'timestamp': DataTypes.DATE,
        'datetime': DataTypes.DATE,
        'date': DataTypes.DATEONLY,
        'time': DataTypes.TIME,

        // Boolean types
        'boolean': DataTypes.BOOLEAN,
        'bool': DataTypes.BOOLEAN,
        'tinyint': DataTypes.BOOLEAN,

        // Binary types
        'blob': DataTypes.BLOB,
        'binary': DataTypes.BLOB,
        'varbinary': DataTypes.BLOB,

        // JSON types
        'json': DataTypes.JSON,
        'jsonb': DataTypes.JSONB,

        // UUID
        'uuid': DataTypes.UUID,

        // Enum
        'enum': DataTypes.ENUM,

        // Array (PostgreSQL)
        'array': DataTypes.ARRAY,

        // Geometry (PostGIS)
        'geometry': DataTypes.GEOMETRY,
        'geography': DataTypes.GEOGRAPHY
    };

    private modelRegistry: ModelRegistry = {};

    constructor(private options: ConversionOptions = {}) { }

    private getSequelizeType(column: Column): any {
        let baseType = this.typeMapping[column.type.toLowerCase()];

        if (!baseType) {
            if (this.options.strictValidation) {
                throw new Error(`Unsupported column type: ${column.type}`);
            }
            baseType = DataTypes.STRING;
        }

        // Handle type with length/precision
        if (column.length) {
            if (baseType === DataTypes.STRING || baseType === DataTypes.CHAR) {
                return baseType(column.length);
            }
        }

        if (column.precision && column.scale !== undefined) {
            if (baseType === DataTypes.DECIMAL) {
                return baseType(column.precision, column.scale);
            }
        } else if (column.precision) {
            if (baseType === DataTypes.DECIMAL) {
                return baseType(column.precision);
            }
        }

        return baseType;
    }

    private buildColumnDefinition(column: Column): ModelAttributeColumnOptions {
        const definition: ModelAttributeColumnOptions = {
            type: this.getSequelizeType(column),
            primaryKey: column.primary_key || false,
            allowNull: column.nullable !== false,
            unique: column.unique || false,
            autoIncrement: column.auto_increment || false
        };

        // Add default value
        if (column.default_value !== undefined) {
            definition.defaultValue = column.default_value;
        }

        // Add comment
        if (column.comment) {
            definition.comment = column.comment;
        }

        // Add validation rules
        if (column.validate) {
            definition.validate = column.validate;
        }

        // Add common validations based on type
        if (!definition.validate) {
            definition.validate = {};
        }

        switch (column.type.toLowerCase()) {
            case 'email':
                (definition.validate as any).isEmail = true;
                definition.type = DataTypes.STRING;
                break;
            case 'url':
                (definition.validate as any).isUrl = true;
                definition.type = DataTypes.STRING;
                break;
            case 'ip':
                (definition.validate as any).isIP = true;
                definition.type = DataTypes.STRING;
                break;
        }

        return definition;
    }

    public convertToSequelize(schema: TableSchema, sequelize: Sequelize) {
        const attributes: { [key: string]: ModelAttributeColumnOptions } = {};

        // Build column definitions
        schema.columns.forEach(column => {
            attributes[column.name] = this.buildColumnDefinition(column);
        });

        // Model options
        const modelOptions: any = {
            tableName: schema.table_name,
            timestamps: this.options.addTimestamps || false,
            paranoid: this.options.paranoid || false,
            underscored: this.options.underscored || false,
            freezeTableName: this.options.freezeTableName !== false,
            indexes: []
        };

        // Add indexes
        if (schema.indexes) {
            modelOptions.indexes = schema.indexes.map(index => ({
                name: index.name,
                fields: index.columns,
                unique: index.unique || false,
                type: index.type
            }));
        }

        // Add column-level indexes
        schema.columns.forEach(column => {
            if (column.index && !column.primary_key && !column.unique) {
                modelOptions.indexes.push({
                    fields: [column.name]
                });
            }
        });

        return sequelize.define(schema.table_name, attributes, modelOptions);
    }

    public convertToSequelizeWithRelations(schema: TableSchema, sequelize: Sequelize) {
        // Create the basic model first
        const model = this.convertToSequelize(schema, sequelize);

        // Register the model
        this.modelRegistry[schema.table_name] = model;

        return model;
    }

    public establishRelations(schemas: TableSchema[], sequelize: Sequelize): ModelRegistry {
        // First, create all models without relations
        schemas.forEach(schema => {
            this.convertToSequelizeWithRelations(schema, sequelize);
        });

        // Then establish all relations
        schemas.forEach(schema => {
            if (schema.relations && schema.relations.length > 0) {
                this.createRelations(schema, sequelize);
            }
        });

        return this.modelRegistry;
    }

    private createRelations(schema: TableSchema, sequelize: Sequelize): void {
        const sourceModel = this.modelRegistry[schema.table_name];
        if (!sourceModel) {
            throw new Error(`Source model ${schema.table_name} not found in registry`);
        }

        schema.relations?.forEach(relation => {
            const targetModel = this.modelRegistry[relation.target];
            if (!targetModel) {
                if (this.options.strictValidation) {
                    throw new Error(`Target model ${relation.target} not found in registry`);
                }
                return; // Skip this relation if target model doesn't exist
            }

            const associationOptions: any = {
                foreignKey: relation.foreignKey,
                targetKey: relation.targetKey,
                as: relation.as,
                onDelete: relation.onDelete || 'SET NULL',
                onUpdate: relation.onUpdate || 'CASCADE',
                constraints: relation.constraints !== false
            };

            // Add scope if provided
            if (relation.scope) {
                associationOptions.scope = relation.scope;
            }

            switch (relation.type) {
                case 'hasOne':
                    sourceModel.hasOne(targetModel, associationOptions);
                    break;

                case 'hasMany':
                    sourceModel.hasMany(targetModel, associationOptions);
                    break;

                case 'belongsTo':
                    sourceModel.belongsTo(targetModel, associationOptions);
                    break;

                case 'belongsToMany':
                    if (!relation.through) {
                        throw new Error(`belongsToMany relation requires 'through' table for ${schema.table_name} -> ${relation.target}`);
                    }
                    associationOptions.through = relation.through;
                    sourceModel.belongsToMany(targetModel, associationOptions);
                    break;

                default:
                    if (this.options.strictValidation) {
                        throw new Error(`Unknown relation type: ${relation.type}`);
                    }
            }
        });
    }

    public getModel(tableName: string): any {
        return this.modelRegistry[tableName];
    }

    public getAllModels(): ModelRegistry {
        return { ...this.modelRegistry };
    }

    public clearRegistry(): void {
        this.modelRegistry = {};
    }

    public validateRelations(schemas: TableSchema[]): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        const tableNames = schemas.map(s => s.table_name);

        schemas.forEach(schema => {
            if (!schema.relations) return;

            schema.relations.forEach((relation, index) => {
                // Check if target table exists
                if (!tableNames.includes(relation.target)) {
                    errors.push(`${schema.table_name}: Relation ${index} references non-existent table '${relation.target}'`);
                }

                // Check belongsToMany has through table
                if (relation.type === 'belongsToMany' && !relation.through) {
                    errors.push(`${schema.table_name}: belongsToMany relation to '${relation.target}' requires 'through' property`);
                }

                // Check foreignKey exists in appropriate table
                if (relation.foreignKey) {
                    let targetSchema: TableSchema | undefined;

                    if (relation.type === 'belongsTo') {
                        // For belongsTo, foreign key should be in source table
                        targetSchema = schema;
                    } else {
                        // For hasOne/hasMany, foreign key should be in target table
                        targetSchema = schemas.find(s => s.table_name === relation.target);
                    }

                    if (targetSchema && !targetSchema.columns.some(col => col.name === relation.foreignKey)) {
                        errors.push(`${schema.table_name}: Foreign key '${relation.foreignKey}' not found in ${targetSchema.table_name}`);
                    }
                }

                // Check targetKey exists in target table
                if (relation.targetKey) {
                    const targetSchema = schemas.find(s => s.table_name === relation.target);
                    if (targetSchema && !targetSchema.columns.some(col => col.name === relation.targetKey)) {
                        errors.push(`${schema.table_name}: Target key '${relation.targetKey}' not found in '${relation.target}'`);
                    }
                }
            });
        });

        return {
            valid: errors.length === 0,
            errors
        };
    }

    public static generateRelationExample(): TableSchema[] {
        return [
            {
                table_name: 'users',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'email', type: 'email', unique: true, nullable: false },
                    { name: 'name', type: 'string', length: 100, nullable: false }
                ],
                relations: [
                    { type: 'hasMany', target: 'posts', foreignKey: 'user_id', as: 'posts' },
                    { type: 'hasOne', target: 'profiles', foreignKey: 'user_id', as: 'profile' },
                    { type: 'belongsToMany', target: 'roles', through: 'user_roles', foreignKey: 'user_id', as: 'roles' }
                ]
            },
            {
                table_name: 'posts',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'title', type: 'string', length: 255, nullable: false },
                    { name: 'content', type: 'text' },
                    { name: 'user_id', type: 'integer', nullable: false },
                    { name: 'category_id', type: 'integer' }
                ],
                relations: [
                    { type: 'belongsTo', target: 'users', foreignKey: 'user_id', as: 'author' },
                    { type: 'belongsTo', target: 'categories', foreignKey: 'category_id', as: 'category' },
                    { type: 'belongsToMany', target: 'tags', through: 'post_tags', foreignKey: 'post_id', as: 'tags' }
                ]
            },
            {
                table_name: 'profiles',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'user_id', type: 'integer', unique: true, nullable: false },
                    { name: 'bio', type: 'text' },
                    { name: 'avatar_url', type: 'url' }
                ],
                relations: [
                    { type: 'belongsTo', target: 'users', foreignKey: 'user_id', as: 'user' }
                ]
            },
            {
                table_name: 'categories',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'name', type: 'string', length: 100, unique: true, nullable: false },
                    { name: 'parent_id', type: 'integer' }
                ],
                relations: [
                    { type: 'hasMany', target: 'posts', foreignKey: 'category_id', as: 'posts' },
                    { type: 'hasMany', target: 'categories', foreignKey: 'parent_id', as: 'children' },
                    { type: 'belongsTo', target: 'categories', foreignKey: 'parent_id', as: 'parent' }
                ]
            },
            {
                table_name: 'roles',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'name', type: 'string', length: 50, unique: true, nullable: false },
                    { name: 'permissions', type: 'json' }
                ],
                relations: [
                    { type: 'belongsToMany', target: 'users', through: 'user_roles', foreignKey: 'role_id', as: 'users' }
                ]
            },
            {
                table_name: 'tags',
                columns: [
                    { name: 'id', type: 'integer', primary_key: true, auto_increment: true },
                    { name: 'name', type: 'string', length: 50, unique: true, nullable: false },
                    { name: 'color', type: 'string', length: 7 }
                ],
                relations: [
                    { type: 'belongsToMany', target: 'posts', through: 'post_tags', foreignKey: 'tag_id', as: 'posts' }
                ]
            },
            {
                table_name: 'user_roles',
                columns: [
                    { name: 'user_id', type: 'integer', primary_key: true },
                    { name: 'role_id', type: 'integer', primary_key: true },
                    { name: 'granted_at', type: 'timestamp', default_value: 'CURRENT_TIMESTAMP' }
                ]
            },
            {
                table_name: 'post_tags',
                columns: [
                    { name: 'post_id', type: 'integer', primary_key: true },
                    { name: 'tag_id', type: 'integer', primary_key: true },
                    { name: 'added_at', type: 'timestamp', default_value: 'CURRENT_TIMESTAMP' }
                ]
            }
        ];
    }

    public validateSchema(schema: TableSchema): { valid: boolean; errors: string[] } {
        const errors: string[] = [];

        // Check table name
        if (!schema.table_name || typeof schema.table_name !== 'string') {
            errors.push('Table name is required and must be a string');
        }

        // Check columns
        if (!schema.columns || !Array.isArray(schema.columns) || schema.columns.length === 0) {
            errors.push('At least one column is required');
        } else {
            // Check for primary key
            const hasPrimaryKey = schema.columns.some(col => col.primary_key);
            if (!hasPrimaryKey && this.options.strictValidation) {
                errors.push('Table must have at least one primary key column');
            }

            // Validate each column
            schema.columns.forEach((column, index) => {
                if (!column.name || typeof column.name !== 'string') {
                    errors.push(`Column at index ${index}: name is required and must be a string`);
                }

                if (!column.type || typeof column.type !== 'string') {
                    errors.push(`Column '${column.name}': type is required and must be a string`);
                }

                // Check for duplicate column names
                const duplicates = schema.columns.filter(col => col.name === column.name);
                if (duplicates.length > 1) {
                    errors.push(`Duplicate column name: ${column.name}`);
                }
            });
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    public static getAvailableTypes(): string[] {
        return Object.keys(new SchemaConverter().typeMapping);
    }
}

// Legacy function for backward compatibility
function convertToSequelize(schema: TableSchema, sequelize: Sequelize, options?: ConversionOptions) {
    const converter = new SchemaConverter(options);
    return converter.convertToSequelize(schema, sequelize);
}

export {
    convertToSequelize,
    SchemaConverter,
    TableSchema,
    Column,
    ConversionOptions,
    TableRelation,
    ModelRegistry
};