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

interface DatabaseConfigs {
    [key: string]: DatabaseConfig;
}

class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logging;

    public readonly APP: AppConfig;
    public readonly SECURITY: SecurityConfig;
    public readonly DATABASES: DatabaseConfigs;

    private constructor() {
        this.logger = Logging.getInstance('ConfigManager');

        this.APP = this.loadAppConfig();
        this.SECURITY = this.loadSecurityConfig();
        this.DATABASES = this.loadDatabaseConfigs();

        this.validateConfig();
        this.logger.info('Configuration loaded successfully');
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

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
                WINDOW_MS: this.parseNumber(process.env.RATE_LIMIT_WINDOW_MS, 900000), // 15 minutes
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

    private loadDatabaseConfigs(): DatabaseConfigs {
        const configs: DatabaseConfigs = {};

        // Load primary database
        if (process.env.DB_HOST || process.env.DB_DIALECT) {
            configs.primary = {
                host: process.env.DB_HOST || 'localhost',
                port: this.parseNumber(process.env.DB_PORT, 5432),
                user: process.env.DB_USER || 'root',
                password: process.env.DB_PASSWORD || '',
                database: process.env.DB_NAME || 'james_db',
                dialect: (process.env.DB_DIALECT as any) || 'sqlite'
            };
        }

        // Load SQLite default if no other database configured
        if (Object.keys(configs).length === 0) {
            configs.primary = {
                host: '',
                port: 0,
                user: '',
                password: '',
                database: process.env.SQLITE_PATH || './data/james.db',
                dialect: 'sqlite'
            };
        }

        // Load additional databases from environment
        const dbPrefixes = this.getEnvPrefixes('DB_');
        dbPrefixes.forEach(prefix => {
            if (prefix !== 'DB_' && process.env[`${prefix}HOST`]) {
                const name = prefix.replace('DB_', '').replace('_', '').toLowerCase();
                configs[name] = {
                    host: process.env[`${prefix}HOST`] || 'localhost',
                    port: this.parseNumber(process.env[`${prefix}PORT`], 5432),
                    user: process.env[`${prefix}USER`] || 'root',
                    password: process.env[`${prefix}PASSWORD`] || '',
                    database: process.env[`${prefix}NAME`] || name,
                    dialect: (process.env[`${prefix}DIALECT`] as any) || 'postgres'
                };
            }
        });

        return configs;
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

    private getEnvPrefixes(prefix: string): string[] {
        return Object.keys(process.env)
            .filter(key => key.startsWith(prefix))
            .map(key => key.split('_').slice(0, 2).join('_') + '_')
            .filter((value, index, self) => self.indexOf(value) === index);
    }

    private validateConfig(): void {
        const errors: string[] = [];

        // Validate APP config
        if (this.APP.PORT < 1 || this.APP.PORT > 65535) {
            errors.push('APP_PORT must be between 1 and 65535');
        }

        if (!['development', 'production', 'test'].includes(this.APP.ENV)) {
            this.logger.warn(`Unknown environment: ${this.APP.ENV}`);
        }

        if (!['debug', 'info', 'warn', 'error'].includes(this.APP.LOG_LEVEL)) {
            errors.push('LOG_LEVEL must be one of: debug, info, warn, error');
        }

        // Validate SECURITY config
        if (this.SECURITY.JWT_SECRET.length < 32) {
            this.logger.warn('JWT_SECRET should be at least 32 characters long');
        }

        if (this.SECURITY.BCRYPT_ROUNDS < 10) {
            this.logger.warn('BCRYPT_ROUNDS should be at least 10 for security');
        }

        // Validate DATABASE configs
        Object.entries(this.DATABASES).forEach(([name, config]) => {
            if (!['mysql', 'postgres', 'sqlite', 'mssql'].includes(config.dialect)) {
                errors.push(`Database '${name}': Invalid dialect '${config.dialect}'`);
            }

            if (config.dialect !== 'sqlite') {
                if (!config.host) {
                    errors.push(`Database '${name}': Host is required for ${config.dialect}`);
                }
                if (!config.database) {
                    errors.push(`Database '${name}': Database name is required`);
                }
            }
        });

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

    public getDatabaseConfig(name: string = 'primary'): DatabaseConfig {
        const config = this.DATABASES[name];
        if (!config) {
            throw new Error(`Database configuration '${name}' not found`);
        }
        return config;
    }

    public getDatabaseNames(): string[] {
        return Object.keys(this.DATABASES);
    }

    public getAppInfo(): { name: string; version: string; environment: string } {
        return {
            name: 'JamesDbApi',
            version: this.APP.API_VERSION,
            environment: this.APP.ENV
        };
    }
}

// Export singleton instance
const configManager = ConfigManager.getInstance();
export default configManager;