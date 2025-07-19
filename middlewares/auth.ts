import { Context, Next } from 'hono';
import { sign, verify } from 'hono/jwt';
import ConfigManager from '../managers/ConfigManager';
import Logging from '../utils/logging';
import { User, JWTPayload } from '../utils/types';

class AuthManager {
    private static instance: AuthManager;
    private logger: Logging;
    private jwtSecret: string;

    private constructor() {
        this.logger = Logging.getInstance('AuthManager');
        this.jwtSecret = ConfigManager.SECURITY.JWT_SECRET;
    }

    public static getInstance(): AuthManager {
        if (!AuthManager.instance) {
            AuthManager.instance = new AuthManager();
        }
        return AuthManager.instance;
    }

    public isRefreshTokenValid(refreshToken: string): boolean {
        return refreshToken === ConfigManager.SECURITY.JWT_SECRET;
    }

    public async generateToken(user: User): Promise<string> {
        const payload: JWTPayload = {
            sub: user.id,
            username: user.username,
            email: user.email,
            roles: user.roles,
            permissions: user.permissions,
            iat: Math.floor(Date.now() / 1000),
            exp: Math.floor(Date.now() / 1000) + this.getTokenExpiry()
        };

        return await sign(payload, this.jwtSecret);
    }

    public async verifyToken(token: string): Promise<JWTPayload | null> {
        try {
            const payload = await verify(token, this.jwtSecret);

            // Validate payload structure
            if (typeof payload !== 'object' || !payload ||
                typeof payload.sub !== 'string' ||
                typeof payload.exp !== 'number') {
                this.logger.warn('Invalid token payload structure');
                return null;
            }

            // Check if token is expired
            if (payload.exp < Math.floor(Date.now() / 1000)) {
                this.logger.warn('Token expired');
                return null;
            }

            return payload as JWTPayload;
        } catch (error) {
            this.logger.warn('Token verification failed:', error);
            return null;
        }
    }

    private getTokenExpiry(): number {
        const expiry = ConfigManager.SECURITY.JWT_EXPIRY;
        const match = expiry.match(/^(\\d+)([smhd])$/);

        if (!match) return 24 * 60 * 60; // Default 24h

        const value = parseInt(match[1], 10);
        const unit = match[2];

        switch (unit) {
            case 's': return value;
            case 'm': return value * 60;
            case 'h': return value * 60 * 60;
            case 'd': return value * 24 * 60 * 60;
            default: return 24 * 60 * 60;
        }
    }

    public extractTokenFromHeader(authorization: string | undefined): string | null {
        if (!authorization) return null;

        const parts = authorization.split(' ');
        if (parts.length !== 2 || parts[0] !== 'Bearer') {
            return null;
        }

        return parts[1];
    }
}

// Authentication middleware
export const authenticate = () => {
    const authManager = AuthManager.getInstance();
    const logger = Logging.getInstance('AuthMiddleware');

    return async (c: Context, next: Next) => {
        const authorization = c.req.header('Authorization');
        const token = authManager.extractTokenFromHeader(authorization);

        if (!token) {
            return c.json({
                error: 'Authentication required',
                message: 'Please provide a valid Bearer token'
            }, 401);
        }

        const payload = await authManager.verifyToken(token);
        if (!payload) {
            return c.json({
                error: 'Invalid token',
                message: 'Token is invalid or expired'
            }, 401);
        }

        // Add user info to context
        c.set('user', {
            id: payload.sub,
            username: payload.username,
            email: payload.email,
            roles: payload.roles,
            permissions: payload.permissions
        });

        logger.debug(`User ${payload.username} authenticated successfully`);
        await next();
    };
};

// Authorization middleware
export const authorize = (...requiredPermissions: string[]) => {
    const logger = Logging.getInstance('AuthzMiddleware');

    return async (c: Context, next: Next) => {
        const user = c.get('user') as User;

        if (!user) {
            return c.json({
                error: 'Authentication required',
                message: 'Please authenticate first'
            }, 401);
        }

        // Check if user has required permissions
        const hasPermission = requiredPermissions.every(permission =>
            user.permissions.includes(permission) ||
            user.roles.includes('admin') ||
            user.roles.includes('super_admin')
        );

        if (!hasPermission) {
            logger.warn(`User ${user.username} denied access. Required: ${requiredPermissions.join(', ')}`);
            return c.json({
                error: 'Insufficient permissions',
                message: `Required permissions: ${requiredPermissions.join(', ')}`,
                user_permissions: user.permissions
            }, 403);
        }

        logger.debug(`User ${user.username} authorized for ${requiredPermissions.join(', ')}`);
        await next();
    };
};

// Role-based authorization
export const requireRole = (...requiredRoles: string[]) => {
    const logger = Logging.getInstance('RoleMiddleware');

    return async (c: Context, next: Next) => {
        const user = c.get('user') as User;

        if (!user) {
            return c.json({
                error: 'Authentication required',
                message: 'Please authenticate first'
            }, 401);
        }

        const hasRole = requiredRoles.some(role =>
            user.roles.includes(role) ||
            user.roles.includes('super_admin')
        );

        if (!hasRole) {
            logger.warn(`User ${user.username} denied access. Required roles: ${requiredRoles.join(', ')}`);
            return c.json({
                error: 'Insufficient role',
                message: `Required roles: ${requiredRoles.join(', ')}`,
                user_roles: user.roles
            }, 403);
        }

        await next();
    };
};

// Optional authentication middleware
export const optionalAuth = () => {
    const authManager = AuthManager.getInstance();

    return async (c: Context, next: Next) => {
        const authorization = c.req.header('Authorization');
        const token = authManager.extractTokenFromHeader(authorization);

        if (token) {
            const payload = await authManager.verifyToken(token);
            if (payload) {
                c.set('user', {
                    id: payload.sub,
                    username: payload.username,
                    email: payload.email,
                    roles: payload.roles,
                    permissions: payload.permissions
                });
            }
        }

        await next();
    };
};

export { AuthManager, User, JWTPayload };
