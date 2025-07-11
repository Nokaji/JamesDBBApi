interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    dialect: 'mysql' | 'postgres' | 'sqlite' | 'mssql';
};

interface User {
    id: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
}

interface JWTPayload {
    sub: string;
    username: string;
    email: string;
    roles: string[];
    permissions: string[];
    iat: number;
    exp: number;
    [key: string]: any; // Allow additional properties for Hono JWT compatibility
}

export { DatabaseConfig, User, JWTPayload };