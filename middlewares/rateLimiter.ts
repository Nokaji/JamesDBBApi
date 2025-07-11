import { Context, Next } from 'hono';
import ConfigManager from '../managers/ConfigManager';
import Logging from '../utils/logging';

interface RateLimitStore {
    [key: string]: {
        count: number;
        resetTime: number;
        firstRequest: number;
    };
}

interface RateLimitOptions {
    windowMs?: number;
    maxRequests?: number;
    message?: string;
    skipSuccessfulRequests?: boolean;
    skipFailedRequests?: boolean;
    keyGenerator?: (c: Context) => string;
    onLimitReached?: (c: Context) => void;
}

class RateLimiter {
    private store: RateLimitStore = {};
    private logger: Logging;
    private cleanupInterval: Timer | null = null;

    constructor(
        private windowMs: number,
        private maxRequests: number,
        private options: RateLimitOptions = {}
    ) {
        this.logger = Logging.getInstance('RateLimiter');
        this.startCleanup();
    }

    private startCleanup() {
        // Clean up expired entries every minute
        this.cleanupInterval = setInterval(() => {
            this.cleanup();
        }, 60000);
    }

    private cleanup() {
        const now = Date.now();
        let cleanedCount = 0;

        for (const key in this.store) {
            if (this.store[key].resetTime < now) {
                delete this.store[key];
                cleanedCount++;
            }
        }

        if (cleanedCount > 0) {
            this.logger.debug(`Cleaned up ${cleanedCount} expired rate limit entries`);
        }
    }

    private getKey(c: Context): string {
        if (this.options.keyGenerator) {
            return this.options.keyGenerator(c);
        }

        // Default key generation strategy
        const forwarded = c.req.header('x-forwarded-for');
        const ip = forwarded ? forwarded.split(',')[0].trim() :
            c.req.header('x-real-ip') ||
            'unknown';

        const user = c.get('user');
        const userId = user?.id;

        return userId ? `user:${userId}` : `ip:${ip}`;
    }

    public async checkLimit(c: Context): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
        const key = this.getKey(c);
        const now = Date.now();

        if (!this.store[key]) {
            this.store[key] = {
                count: 1,
                resetTime: now + this.windowMs,
                firstRequest: now
            };

            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: this.store[key].resetTime
            };
        }

        const entry = this.store[key];

        // Check if window has expired
        if (now >= entry.resetTime) {
            entry.count = 1;
            entry.resetTime = now + this.windowMs;
            entry.firstRequest = now;

            return {
                allowed: true,
                remaining: this.maxRequests - 1,
                resetTime: entry.resetTime
            };
        }

        // Increment count
        entry.count++;

        const allowed = entry.count <= this.maxRequests;
        const remaining = Math.max(0, this.maxRequests - entry.count);

        if (!allowed && this.options.onLimitReached) {
            this.options.onLimitReached(c);
        }

        return {
            allowed,
            remaining,
            resetTime: entry.resetTime
        };
    }

    public getStats(): { totalKeys: number; activeWindows: number } {
        const now = Date.now();
        const activeWindows = Object.values(this.store).filter(entry => entry.resetTime > now).length;

        return {
            totalKeys: Object.keys(this.store).length,
            activeWindows
        };
    }

    public reset(key?: string) {
        if (key) {
            delete this.store[key];
        } else {
            this.store = {};
        }
    }

    public destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            this.cleanupInterval = null;
        }
        this.store = {};
    }
}

// Global rate limiter instance
const globalRateLimiter = new RateLimiter(
    ConfigManager.APP.RATE_LIMIT.WINDOW_MS,
    ConfigManager.APP.RATE_LIMIT.MAX_REQUESTS
);

// Rate limiting middleware factory
export const rateLimit = (options: RateLimitOptions = {}) => {
    const windowMs = options.windowMs || ConfigManager.APP.RATE_LIMIT.WINDOW_MS;
    const maxRequests = options.maxRequests || ConfigManager.APP.RATE_LIMIT.MAX_REQUESTS;
    const message = options.message || 'Too many requests, please try again later';

    const limiter = new RateLimiter(windowMs, maxRequests, options);
    const logger = Logging.getInstance('RateLimitMiddleware');

    return async (c: Context, next: Next) => {
        const result = await limiter.checkLimit(c);

        // Set rate limit headers
        c.header('X-RateLimit-Limit', maxRequests.toString());
        c.header('X-RateLimit-Remaining', result.remaining.toString());
        c.header('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());
        c.header('X-RateLimit-Window', Math.ceil(windowMs / 1000).toString());

        if (!result.allowed) {
            const retryAfter = Math.ceil((result.resetTime - Date.now()) / 1000);
            c.header('Retry-After', retryAfter.toString());

            logger.warn('Rate limit exceeded for request');

            return c.json({
                error: 'Rate limit exceeded',
                message,
                retry_after: retryAfter,
                limit: maxRequests,
                window_ms: windowMs
            }, 429);
        }

        await next();
    };
};

// Predefined rate limiters for different scenarios
export const strictRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 20,
    message: 'Too many requests from this IP, please try again later'
});

export const authRateLimit = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts, please try again later',
    keyGenerator: (c) => {
        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
            c.req.header('x-real-ip') ||
            'unknown';
        return `auth:${ip}`;
    }
});

export const apiRateLimit = rateLimit({
    windowMs: ConfigManager.APP.RATE_LIMIT.WINDOW_MS,
    maxRequests: ConfigManager.APP.RATE_LIMIT.MAX_REQUESTS,
    message: 'API rate limit exceeded',
    keyGenerator: (c) => {
        const user = c.get('user');
        if (user?.id) {
            return `api:user:${user.id}`;
        }

        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
            c.req.header('x-real-ip') ||
            'unknown';
        return `api:ip:${ip}`;
    }
});

export const databaseRateLimit = rateLimit({
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 30,
    message: 'Database operation rate limit exceeded',
    keyGenerator: (c) => {
        const user = c.get('user');
        const database = c.req.param('database') || 'unknown';

        if (user?.id) {
            return `db:${database}:user:${user.id}`;
        }

        const ip = c.req.header('x-forwarded-for')?.split(',')[0].trim() ||
            c.req.header('x-real-ip') ||
            'unknown';
        return `db:${database}:ip:${ip}`;
    }
});

// Rate limiter status endpoint
export const getRateLimitStatus = () => {
    return (c: Context) => {
        const stats = globalRateLimiter.getStats();

        return c.json({
            rate_limiter: {
                window_ms: ConfigManager.APP.RATE_LIMIT.WINDOW_MS,
                max_requests: ConfigManager.APP.RATE_LIMIT.MAX_REQUESTS,
                active_windows: stats.activeWindows,
                total_tracked: stats.totalKeys
            },
            timestamp: Date.now()
        });
    };
};

export { RateLimiter, globalRateLimiter };
