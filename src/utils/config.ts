import crypto from 'crypto';
import dotenv from 'dotenv';
import { Config, DatabaseConfig } from './types';
import Logging from './logging';

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
    BCRYPT_ROUNDS: number;
    SESSION_SECRET: string;
    CSRF_SECRET: string;
    HTTPS_ONLY: boolean;
    SECURE_COOKIES: boolean;
}

interface RedisConfig {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
}

import path from 'path';
import fs from 'fs';
import { object } from 'zod';
import { RedisManager } from '../middlewares/redis';

interface DatabaseConfigEntry {
    name: string;
    config: DatabaseConfig;
}

class ConfigManager {
    private static instance: ConfigManager;
    private logger: Logging;

    public readonly APP: AppConfig;
    public readonly SECURITY: SecurityConfig;
    public readonly REDIS: RedisConfig;
    private redisManager: RedisManager;
    private config: Config;
    private servicePath: string;
    private configPath: string;

    private constructor() {
        this.logger = Logging.getInstance('ConfigManager');

        const home = process.env.HOME || process.env.USERPROFILE;
        if (!home) throw new Error('Cannot determine user home directory.');
        this.configPath = process.platform === 'darwin'
            ? path.join(home, 'Library', 'Application Support')
            : path.join(home, '.config');

        this.servicePath = path.join(this.configPath, 'James', 'services', 'JamesDBBApi');
        if (!fs.existsSync(this.servicePath)) fs.mkdirSync(this.servicePath, { recursive: true });

        this.configPath = path.join(this.servicePath, 'config.json');
        this.ensureEnvironmentVariables();
        this.ensureConfig();

        // Charger le config.json en premier
        this.config = JSON.parse(fs.readFileSync(this.configPath, 'utf-8'));

        dotenv.config({ path: path.join(this.servicePath, '.env') });
        this.redisManager = RedisManager.getInstance();

        this.APP = this.loadAppConfig();
        this.SECURITY = this.loadSecurityConfig();
        this.REDIS = this.loadRedisConfig();

        this.validateConfig();

        this.logger.info('Configuration loaded successfully');
    }

    public static getInstance(): ConfigManager {
        if (!ConfigManager.instance) {
            ConfigManager.instance = new ConfigManager();
        }
        return ConfigManager.instance;
    }

    private ensureEnvironmentVariables() {
        if (!fs.existsSync(path.join(this.servicePath, '.env'))) {
            fs.copyFile(".env.example", path.join(this.servicePath, ".env"), (err) => {
                if (err) {
                    this.logger.error('Failed to copy .env.example to .env:', err);
                } else {
                    this.logger.info('.env.example copied to .env. Please update it with your configuration.');
                }
            });
        }
    }

    public save() {
        fs.writeFileSync(this.configPath, JSON.stringify(this.config, null, 2));
        this.logger.info('Configuration saved to', this.configPath);
    }

    private ensureConfig() {
        if (!fs.existsSync(this.configPath)) {
            fs.writeFileSync(this.configPath, JSON.stringify({ databases: {} }, null, 2));
        }
    }

    // --- Database config management ---

    public getAllDatabaseConfigs(): DatabaseConfigEntry[] {
        if (!this.config) this.ensureConfig();
        return Object.entries(this.config.databases || {}).map(([name, config]) => ({
            name,
            config
        }));
    }

    public addOrUpdateDatabaseConfig(entry: DatabaseConfigEntry): void {
        if (!this.config) this.ensureConfig();
        if (!this.config.databases) {
            this.config.databases = {};
        }
        this.config.databases[entry.name] = entry.config;
        this.redisManager.publish('config:update', JSON.stringify(this.config));
        this.save();
        this.logger.info(`Database config '${entry.name}' saved.`);
    }

    public removeDatabaseConfig(name: string): void {
        if (!this.config) this.ensureConfig();
        if (this.config.databases && this.config.databases[name]) {
            delete this.config.databases[name];
            this.redisManager.publish('config:update', JSON.stringify(this.config));
            this.save();
            this.logger.info(`Database config '${name}' removed.`);
        } else {
            this.logger.warn(`Database config '${name}' not found.`);
        }
    }

    /**
     * Remplace toutes les configs BDD par la liste fournie (reset complet)
     */
    public setAllDatabaseConfigs(entries: DatabaseConfigEntry[]): void {
        if (!this.config) this.ensureConfig();
        this.config.databases = {};
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
        let jwtSecret = process.env.JWT_SECRET;
        if (!jwtSecret) {
            jwtSecret = this.generateRandomSecret(128);
            const envPath = path.join(this.servicePath, '.env');
            let envContent = '';
            if (fs.existsSync(envPath)) {
                envContent = fs.readFileSync(envPath, 'utf-8');
                if (!/^JWT_SECRET=/m.test(envContent)) {
                    envContent += `\nJWT_SECRET=${jwtSecret}\n`;
                } else {
                    envContent = envContent.replace(/^JWT_SECRET=.*$/m, `JWT_SECRET=${jwtSecret}`);
                }
            } else {
                envContent = `JWT_SECRET=${jwtSecret}\n`;
            }
            fs.writeFileSync(envPath, envContent, 'utf-8');
            this.logger.info('JWT_SECRET generated and saved to .env');
        }

        return {
            JWT_SECRET: jwtSecret,
            BCRYPT_ROUNDS: this.parseNumber(process.env.BCRYPT_ROUNDS, 12),
            SESSION_SECRET: process.env.SESSION_SECRET || this.generateRandomSecret(),
            CSRF_SECRET: process.env.CSRF_SECRET || this.generateRandomSecret(),
            HTTPS_ONLY: process.env.HTTPS_ONLY === 'true',
            SECURE_COOKIES: process.env.SECURE_COOKIES === 'true'
        };
    }

    private loadRedisConfig(): RedisConfig {
        return {
            HOST: process.env.REDIS_HOST || 'localhost',
            PORT: this.parseNumber(process.env.REDIS_PORT, 6379),
            USERNAME: process.env.REDIS_USERNAME || '',
            PASSWORD: process.env.REDIS_PASSWORD || ''
        };
    }

    private parseNumber(value: string | undefined, defaultValue: number): number {
        if (!value) return defaultValue;
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? defaultValue : parsed;
    }

    private generateRandomSecret(byte: number = 32): string {
        if (this.APP?.ENV === 'production') {
            this.logger.warn('Using generated secret in production. Please set proper environment variables.');
        }
        // Generate a cryptographically secure 32-byte secret (256 bits), encoded as base64
        return crypto.randomBytes(byte).toString('base64');
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