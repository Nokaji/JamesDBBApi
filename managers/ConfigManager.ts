import dotenv from 'dotenv';
import { DatabaseConfig } from '../utils/types';
import Logging from '../utils/logging';

// Load environment variables
dotenv.config();

interface AppConfig {
    ENV: string;
    PORT: number;
    HOST: string;
    DEBUG: boolean;
    LOG_LEVEL: 'debug' | 'info' | 'warn' | 'error';
    MAX_REQUEST_SIZE: string;
    REQUEST_TIMEOUT: number;
    CORS_ORIGINS: string[];
    API_VERSION: string;
    RATE_LIMIT: {
        WINDOW_MS: number;
        MAX_REQUESTS: number;
    };
}

interface SecurityConfig {
    JWT_SECRET: string;
    JWT_EXPIRY: string;
    BCRYPT_ROUNDS: number;
    SESSION_SECRET: string;
    CSRF_SECRET: string;
    HTTPS_ONLY: boolean;
    SECURE_COOKIES: boolean;
}


import Database from 'bun:sqlite';
import path from 'path';
import fs from 'fs';

interface DatabaseConfigEntry {
    name: string;
    config: DatabaseConfig;
}

class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logging;

    public readonly APP: AppConfig;
    public readonly SECURITY: SecurityConfig;

    private db: Database | null = null;
    private dbPath: string;

    private constructor() {
        this.logger = Logging.getInstance('ConfigManager');

        this.APP = this.loadAppConfig();
        this.SECURITY = this.loadSecurityConfig();

        this.dbPath = path.resolve(process.cwd(), 'data', 'james.db');
        this.ensureDb();

        this.validateConfig();
        this.logger.info('Configuration loaded successfully');
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private ensureDb() {
        const dir = path.dirname(this.dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        this.db = new Database(this.dbPath);
        this.db.run(`CREATE TABLE IF NOT EXISTS db_configs (
            name TEXT PRIMARY KEY,
            config TEXT NOT NULL
        )`);
    }

    // --- Database config management ---

    public getAllDatabaseConfigs(): DatabaseConfigEntry[] {
        if (!this.db) this.ensureDb();
        const rows = this.db!.query('SELECT name, config FROM db_configs').all() as { name: string; config: string }[];
        return rows.map(row => ({
            name: row.name,
            config: JSON.parse(row.config)
        }));
    }

    public getDatabaseConfig(name: string): DatabaseConfigEntry | null {
        if (!this.db) this.ensureDb();
        const row = this.db!.query('SELECT name, config FROM db_configs WHERE name = ?').get([name]) as { name: string; config: string } | undefined;
        if (!row) return null;
        return { name: row.name, config: JSON.parse(row.config) };
    }

    public addOrUpdateDatabaseConfig(entry: DatabaseConfigEntry): void {
        if (!this.db) this.ensureDb();
        this.db!.run(
            'INSERT OR REPLACE INTO db_configs (name, config) VALUES (?, ?)',
            [entry.name, JSON.stringify(entry.config)]
        );
        this.logger.info(`Database config '${entry.name}' saved.`);
    }

    public removeDatabaseConfig(name: string): void {
        if (!this.db) this.ensureDb();
        this.db!.run('DELETE FROM db_configs WHERE name = ?', [name]);
        this.logger.info(`Database config '${name}' removed.`);
    }

    /**
     * Remplace toutes les configs BDD par la liste fournie (reset complet)
     */
    public setAllDatabaseConfigs(entries: DatabaseConfigEntry[]): void {
        if (!this.db) this.ensureDb();
        this.db!.run('DELETE FROM db_configs');
        for (const entry of entries) {
            this.addOrUpdateDatabaseConfig(entry);
        }
        this.logger.info(`All database configs replaced (${entries.length} entries).`);
    }

    // --- App & Security config (inchangé) ---

    private loadAppConfig(): AppConfig {
        return {
            ENV: process.env.NODE_ENV || 'development',
            PORT: this.parseNumber(process.env.APP_PORT, 3000),
            HOST: process.env.APP_HOST || 'localhost',
            DEBUG: process.env.DEBUG === 'true',
            LOG_LEVEL: (process.env.LOG_LEVEL as any) || 'info',
            MAX_REQUEST_SIZE: process.env.MAX_REQUEST_SIZE || '10mb',
            REQUEST_TIMEOUT: this.parseNumber(process.env.REQUEST_TIMEOUT, 30000),
            CORS_ORIGINS: process.env.CORS_ORIGINS ? process.env.CORS_ORIGINS.split(',') : ['*'],
            API_VERSION: process.env.API_VERSION || 'v1',
            RATE_LIMIT: {
                WINDOW_MS: this.parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000),
                MAX_REQUESTS: this.parseNumber(process.env.RATE_LIMIT_MAX_REQUESTS, 100)
            }
        };
    }

    private loadSecurityConfig(): SecurityConfig {
        return {
            JWT_SECRET: process.env.JWT_SECRET || this.generateRandomSecret(),
            JWT_EXPIRY: process.env.JWT_EXPIRY || '24h',
            BCRYPT_ROUNDS: this.parseNumber(process.env.BCRYPT_ROUNDS, 12),
            SESSION_SECRET: process.env.SESSION_SECRET || this.generateRandomSecret(),
            CSRF_SECRET: process.env.CSRF_SECRET || this.generateRandomSecret(),
            HTTPS_ONLY: process.env.HTTPS_ONLY === 'true',
            SECURE_COOKIES: process.env.SECURE_COOKIES === 'true'
        };
    }

    private parseNumber(value: string | undefined, defaultValue: number): number {
        if (!value) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    private generateRandomSecret(): string {
        if (this.APP?.ENV === 'production') {
            this.logger.warn('Using generated secret in production. Please set proper environment variables.');
        }
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    private validateConfig(): void {
        const errors: string[] = [];

        if (this.APP.PORT < 1 || this.APP.PORT > 65535) {
            errors.push('APP_PORT must be between 1 and 65535');
        }
        if (!['development', 'production', 'test'].includes(this.APP.ENV)) {
            this.logger.warn(`Unknown environment: ${this.APP.ENV}`);
        }
        if (!['debug', 'info', 'warn', 'error'].includes(this.APP.LOG_LEVEL)) {
            errors.push('LOG_LEVEL must be one of: debug, info, warn, error');
        }
        if (this.SECURITY.JWT_SECRET.length < 32) {
            this.logger.warn('JWT_SECRET should be at least 32 characters long');
        }
        if (this.SECURITY.BCRYPT_ROUNDS < 10) {
            this.logger.warn('BCRYPT_ROUNDS should be at least 10 for security');
        }
        if (errors.length > 0) {
            this.logger.error('Configuration validation failed:');
            errors.forEach(error => this.logger.error(`  - ${error}`));
            throw new Error('Invalid configuration');
        }
    }

    public isDevelopment(): boolean {
        return this.APP.ENV === 'development';
    }

    public isProduction(): boolean {
        return this.APP.ENV === 'production';
    }

    public isTest(): boolean {
        return this.APP.ENV === 'test';
    }

    public getAppInfo(): { name: string; version: string; environment: string } {
        return {
            name: 'JamesDbApi',
            version: this.APP.API_VERSION,
            environment: this.APP.ENV
        };
    }
}

const configManager = ConfigManager.getInstance();
export default configManager;