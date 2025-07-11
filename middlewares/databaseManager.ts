import { DatabaseConfig } from "../utils/types.ts";
import { Sequelize } from 'sequelize';

class Database {
    private static instance: Database;
    private connection: any; // Replace with actual database connection type
    private static config: DatabaseConfig;
}

class DatabaseManager {
    private static instance: DatabaseManager;
    private databases: Map<string, Database> = new Map();

    private constructor() {
        // Initialize database connection or ORM here
    }

    public static getInstance(): DatabaseManager {
        if (!DatabaseManager.instance) {
            DatabaseManager.instance = new DatabaseManager();
        }
        return DatabaseManager.instance;
    }

    public connect() {

    }

    public disconnect() {

    }
};