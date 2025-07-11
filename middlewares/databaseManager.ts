import { DatabaseConfig } from "../utils/types.ts";
import { Sequelize, DataTypes } from 'sequelize';
import Logging from "../utils/logging.ts";

import configManager from "../managers/ConfigManager.ts";

class Database {
    private connection: Sequelize;
    private config: DatabaseConfig;
    private logger: Logging;
    private isConnected: boolean = false;

    constructor(config: DatabaseConfig) {
        this.config = config;
        this.logger = Logging.getInstance(config.database);
        this.connection = this.createConnection();
    }

    private createConnection(): Sequelize {
        const { host, port, user, password, database, dialect } = this.config;

        let sequelize: Sequelize;

        if (dialect === 'sqlite') {
            sequelize = new Sequelize({
                dialect: 'sqlite',
                storage: database,
                logging: (msg) => this.logger.debug(msg)
            });
        } else {
            sequelize = new Sequelize(database, user, password, {
                host,
                port,
                dialect,
                logging: (msg) => this.logger.debug(msg),
                pool: {
                    max: 10,
                    min: 0,
                    acquire: 30000,
                    idle: 10000
                }
            });
        }

        return sequelize;
    }

    public async connect(): Promise<void> {
        try {
            await this.connection.authenticate();
            this.isConnected = true;
            this.logger.info(`Connected to ${this.config.dialect} database successfully`);
        } catch (error) {
            this.isConnected = false;
            this.logger.error(`Failed to connect to database: ${error}`);
            throw error;
        }
    }

    public async disconnect(): Promise<void> {
        if (!this.isConnected) {
            this.logger.debug('Database already disconnected');
            return;
        }

        try {
            await this.connection.close();
            this.isConnected = false;
            this.logger.info('Database connection closed');
        } catch (error: any) {
            // Si l'erreur indique que la connexion est déjà fermée, on l'ignore
            if (error?.code === 'SQLITE_MISUSE' ||
                (error?.message && error.message.includes('closed'))) {
                this.isConnected = false;
                this.logger.debug('Database connection was already closed');
                return;
            }
            this.logger.error(`Error closing database connection: ${error}`);
            this.isConnected = false; // Marquer comme déconnecté même en cas d'erreur
            throw error;
        }
    }

    public getConnection(): Sequelize {
        if (!this.isConnected) {
            throw new Error('Database not connected. Call connect() first.');
        }
        return this.connection;
    }

    public getConfig(): DatabaseConfig {
        return this.config;
    }

    public isHealthy(): boolean {
        return this.isConnected;
    }

    public async sync(options?: { force?: boolean; alter?: boolean }): Promise<void> {
        try {
            await this.connection.sync(options);
            this.logger.info('Database synchronized successfully');
        } catch (error) {
            this.logger.error(`Database sync failed: ${error}`);
            throw error;
        }
    }
}

class DatabaseManager {
    private static instance: DatabaseManager;
    private databases: Map<string, Database> = new Map();
    private logger: Logging;

    private constructor() {
        this.logger = Logging.getInstance('DatabaseManager');
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public async addDatabase(name: string, config: DatabaseConfig): Promise<void> {
        try {
            const database = new Database(config);
            configManager.addOrUpdateDatabaseConfig({ name, config });
            await database.connect();
            this.databases.set(name, database);
            this.logger.info(`Database '${name}' added and connected successfully`);
        } catch (error) {
            this.logger.error(`Failed to add database '${name}': ${error}`);
            throw error;
        }
    }

    public async setDatabases(name: string, config: DatabaseConfig): Promise<void> {
        const existingDb = this.databases.get(name);
        if (existingDb) {
            await existingDb.disconnect();
            this.databases.delete(name);
            this.logger.info(`Disconnected existing database '${name}'`);
        }
        const database = new Database(config);
        this.databases.set(name, database);
        await database.connect(); // Connect the new database
        this.logger.info(`Database '${name}' set successfully`);
    }

    public getDatabase(name: string): Database {
        const database = this.databases.get(name);
        if (!database) {
            throw new Error(`Database '${name}' not found`);
        }
        return database;
    }

    public async removeDatabase(name: string): Promise<void> {
        const database = this.databases.get(name);
        if (database) {
            await database.disconnect();
            this.databases.delete(name);
            configManager.removeDatabaseConfig(name);
            this.logger.info(`Database '${name}' removed`);
        }
    }

    public async disconnectAll(): Promise<void> {
        const disconnectPromises = Array.from(this.databases.entries()).map(async ([name, db]) => {
            try {
                await db.disconnect();
                this.logger.debug(`Database '${name}' disconnected successfully`);
            } catch (error: any) {
                // Ne pas propager l'erreur, juste la loguer
                this.logger.warn(`Failed to disconnect database '${name}': ${error?.message || error}`);
            }
        });

        await Promise.allSettled(disconnectPromises);
        this.databases.clear();
        this.logger.info('All databases disconnected');
    }

    public getHealthStatus(): { [key: string]: boolean } {
        const status: { [key: string]: boolean } = {};
        this.databases.forEach((db, name) => {
            status[name] = db.isHealthy();
        });
        return status;
    }

    public getDatabaseNames(): string[] {
        return Array.from(this.databases.keys());
    }
}

export { DatabaseManager, Database };