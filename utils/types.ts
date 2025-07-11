interface DatabaseConfig {
    host: string;
    port: number;
    user: string;
    password: string;
    database: string;
    dialect: 'mysql' | 'postgres' | 'sqlite' | 'mssql';
};

export { DatabaseConfig };