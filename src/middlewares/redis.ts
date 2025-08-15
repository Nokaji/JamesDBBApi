import { createClient } from 'redis';
import { v4 as uuidv4 } from 'uuid';
import { Service } from '../utils/types';
import { getPublicIPAddress } from '../utils/utils';
import { randomUUID } from 'crypto';

interface RedisConfig {
    HOST: string;
    PORT: number;
    USERNAME: string;
    PASSWORD: string;
}

export class RedisManager {
    private static instance: RedisManager;
    private readonly CHANNEL_PREFIX = 'services:jamesdbbapi:';
    private redisClient: ReturnType<typeof createClient>;
    private subscriberClient: ReturnType<typeof createClient>;
    private readonly currentInstance: Service;
    private redisConfig: RedisConfig;

    public getCurrentInstance(): Service {
        return this.currentInstance;
    }

    public getChannelPrefix(): string {
        return this.CHANNEL_PREFIX;
    }

    public async acquireLock(key: string, ttl_seconds: number): Promise<boolean> {
        try {
            return await this.redisClient.set(key, this.currentInstance.id, { NX: true, EX: ttl_seconds }) === 'OK';
        } catch {
            return false;
        }
    }

    public async releaseLock(key: string): Promise<void> {
        try {
            await this.redisClient.del(key);
        } catch (err) {
            throw err;
        }
    }

    private constructor(redisConfig: RedisConfig) {
        // Initialiser currentInstance en premier pour garantir qu'il soit fixe
        this.currentInstance = {
            id: randomUUID(),
            host: getPublicIPAddress(),
            createdAt: new Date()
        };

        this.redisConfig = redisConfig;

        // Client principal pour les opérations normales
        this.redisClient = createClient({
            url: `redis://${this.redisConfig.HOST}:${this.redisConfig.PORT}`,
            password: this.redisConfig.PASSWORD,
            username: this.redisConfig.USERNAME
        });

        // Client séparé pour les subscriptions
        this.subscriberClient = createClient({
            url: `redis://${this.redisConfig.HOST}:${this.redisConfig.PORT}`,
            password: this.redisConfig.PASSWORD,
            username: this.redisConfig.USERNAME
        });

        this.redisClient.connect();
        this.subscriberClient.connect();
    }

    public async listen(channel: string, callback: (message: string) => void): Promise<void> {
        this.subscriberClient.subscribe(this.CHANNEL_PREFIX + channel, (message) => {
            callback(message);
        });
    }

    public async publish(channel: string, message: string): Promise<void> {
        const client = await this.getClient();
        client.publish(this.CHANNEL_PREFIX + channel, message);
    }

    public async disconnect(): Promise<void> {
        await Promise.all([
            this.redisClient.quit(),
            this.subscriberClient.quit()
        ]);
    }

    public async getClient(): Promise<ReturnType<typeof createClient>> {
        return this.redisClient;
    }

    public registerInstance(): void {
        this.redisClient.set(
            this.CHANNEL_PREFIX + 'instances:' + this.getCurrentInstance().id,
            JSON.stringify(this.getCurrentInstance())
        );
        this.redisClient.expire(this.CHANNEL_PREFIX + 'instances:' + this.getCurrentInstance().id, 15);
    }

    public refreshInstance(): void {
        this.redisClient.expire(this.CHANNEL_PREFIX + 'instances:' + this.getCurrentInstance().id, 15);
        console.log("Refreshed Redis instances:", this.getCurrentInstance().id);
    }

    public static getInstance(redisConfig?: RedisConfig): RedisManager {
        if (!RedisManager.instance) {
            if (!redisConfig) {
                throw new Error('RedisConfig is required for first initialization');
            }
            RedisManager.instance = new RedisManager(redisConfig);
        }
        return RedisManager.instance;
    }
};