import { createClient } from 'redis';
import configManager from '../utils/config';
import { v4 as uuidv4 } from 'uuid';
import { Service } from '../utils/types';
import { getPublicIPAddress } from '../utils/utils';
import { randomUUID } from 'crypto';

export class RedisManager {
    private static instance: RedisManager;
    private readonly CHANNEL_PREFIX = 'services:jamesdbbapi:';
    private redisClient: ReturnType<typeof createClient>;
    private readonly currentInstance: Service;

    public getCurrentInstance(): Service {
        return this.currentInstance;
    }

    public getChannelPrefix(): string {
        return this.CHANNEL_PREFIX;
    }

    private constructor() {
        // Initialiser currentInstance en premier pour garantir qu'il soit fixe
        this.currentInstance = {
            id: randomUUID(),
            host: getPublicIPAddress(),
            createdAt: new Date()
        };

        this.redisClient = createClient({
            url: `redis://${configManager.REDIS.HOST}:${configManager.REDIS.PORT}`,
            password: configManager.REDIS.PASSWORD,
            username: configManager.REDIS.USERNAME
        });
        this.redisClient.connect();
    }

    public async listen(channel: string, callback: (message: string) => void): Promise<void> {
        const client = await this.getClient();
        client.subscribe(this.CHANNEL_PREFIX + channel, (message) => {
            callback(message);
        });
    }

    public async publish(channel: string, message: string): Promise<void> {
        const client = await this.getClient();
        client.publish(this.CHANNEL_PREFIX + channel, message);
    }

    public async disconnect(): Promise<void> {
        await this.redisClient.quit();
    }

    public async getClient(): Promise<ReturnType<typeof createClient>> {
        if (!this.redisClient) {
            this.redisClient = createClient({
                url: `redis://${configManager.REDIS.HOST}:${configManager.REDIS.PORT}`,
                password: configManager.REDIS.PASSWORD,
                username: configManager.REDIS.USERNAME
            });
            await this.redisClient.connect();
        }
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

    public static getInstance(): RedisManager {
        if (!RedisManager.instance) {
            RedisManager.instance = new RedisManager();
        }
        return RedisManager.instance;
    }
};