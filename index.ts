import { Hono } from "hono";
import { isRunningOnBun } from "./utils/runtime";
import ConfigManager from "./managers/ConfigManager";
import { DatabaseManager } from "./middlewares/database";
import { generateSwaggerSpec } from "./utils/swagger";
import schema from "./routes/schema.routes";
import database from "./routes/database.routes";
import relation from "./routes/relation.routes";
import { etag } from "hono/etag";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { cache } from "hono/cache";
import { secureHeaders } from "hono/secure-headers";
import { logger as honoLogger } from "hono/logger";
import { timeout } from "hono/timeout";
import Logging from "./utils/logging";
import { graphqlServer } from "@hono/graphql-server";

const { serveStatic } = isRunningOnBun()
    ? await import("hono/bun")
    : await import("@hono/node-server/serve-static");
const { serve } = isRunningOnBun()
    ? await import("bun")
    : await import("@hono/node-server");

class App {
    app: Hono = new Hono();
    startTime: number = Date.now();
    logger: Logging = Logging.getInstance();
    dbManager: DatabaseManager = DatabaseManager.getInstance();

    constructor() {
        this.initializeDatabase();
        this.dbManager.startAutoRetry();
        this.initRouter();
        this.initServer();
    }

    private async initializeDatabase() {
        try {
            // Initialiser les bases de données configurées
            const db = ConfigManager.getAllDatabaseConfigs();
            if (db.length === 0) {
                this.logger.warn('No database configurations found, skipping initialization');
                return;
            }
            for (const config of db) {
                await this.dbManager.setDatabases(config.name, config.config); // Set or add the database
            }
            this.logger.info(`Initialized ${db.length} database connection(s)`);
        } catch (error) {
            this.logger.error('Failed to initialize databases:', error);
            if (ConfigManager.isProduction()) {
                process.exit(1);
            }
        }
    }

    private initRouter() {
        // Global error handler
        this.app.onError((err, c) => {
            this.logger.error('Unhandled error:', err);
            return c.json({
                error: 'Internal Server Error',
                message: ConfigManager.isDevelopment() ? err.message : 'Something went wrong',
                timestamp: Date.now()
            }, 500);
        });

        // Request timeout
        this.app.use('*', timeout(ConfigManager.APP.REQUEST_TIMEOUT));

        // Logging middleware
        if (ConfigManager.isDevelopment()) {
            this.app.use('*', honoLogger());
        }

        // Security headers
        this.app.use(
            "*",
            secureHeaders({
                strictTransportSecurity: ConfigManager.isProduction()
                    ? "max-age=63072000; includeSubDomains; preload"
                    : false,
                xFrameOptions: "DENY",
                xXssProtection: "1",
                xContentTypeOptions: "nosniff",
                referrerPolicy: "strict-origin-when-cross-origin"
            })
        );

        // HTTPS redirect in production
        if (ConfigManager.isProduction()) {
            this.app.use("*", async (c, next) => {
                const proto = c.req.header("x-forwarded-proto");
                const host = c.req.header("host");
                // N'applique la redirection que si x-forwarded-proto est présent (donc derrière un proxy SSL)
                if (proto && proto !== "https" && host) {
                    return c.redirect(`https://${host}${c.req.url}`, 301);
                }
                return next();
            });
        }

        // CORS
        this.app.use(cors({
            origin: ConfigManager.APP.CORS_ORIGINS,
            allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
            exposeHeaders: ['X-Total-Count'],
            credentials: true
        }));

        // CSRF protection
        if (ConfigManager.isProduction()) {
            this.app.use(csrf());
        }

        // ETag
        this.app.use(etag());

        // Content-Type validation
        this.app.use(async (c, next) => {
            const method = c.req.method;
            const contentType = c.req.header('content-type');

            if (['POST', 'PUT', 'PATCH'].includes(method)) {
                if (!contentType || !contentType.includes('application/json')) {
                    return c.json({
                        error: 'Invalid Content-Type',
                        expected: 'application/json',
                        received: contentType || 'none'
                    }, 400);
                }
            }
            await next();
        });

        // Request size validation
        this.app.use(async (c, next) => {
            const contentLength = c.req.header('content-length');
            if (contentLength) {
                const maxSize = parseInt(ConfigManager.APP.MAX_REQUEST_SIZE.replace(/\D/g, ''), 10) * 1024 * 1024; // Convert MB to bytes
                if (parseInt(contentLength, 10) > maxSize) {
                    return c.json({
                        error: 'Request too large',
                        max_size: ConfigManager.APP.MAX_REQUEST_SIZE,
                        received_size: `${Math.round(parseInt(contentLength, 10) / 1024 / 1024)}MB`
                    }, 413);
                }
            }
            await next();
        });

        this.app.use("*", async (c, next) => {
            // Authentication middleware
            if (c.req.header('Authorization') === `Bearer ${ConfigManager.SECURITY.JWT_SECRET}`) {
                await next();
            }
            else {
                return c.json({
                    error: 'Unauthorized',
                    message: 'Invalid or missing Authorization header'
                }, 401);
            }
        });

        this.app.get("*", cache({
            cacheName: 'JamesDBBApiCache',
            cacheControl: 'max-age=3600', // 1 hour
            wait: true, // Required for Deno environment
            cacheableStatusCodes: [200, 203, 204, 206, 300, 301, 404]
        }));

        // API versioning
        const api = new Hono();

        // API routes
        api.route("/schema", schema);
        api.route("/database", database);
        api.route("/relation", relation);

        // API info endpoint
        api.get("/", (c) => {
            const appInfo = ConfigManager.getAppInfo();
            return c.json({
                ...appInfo,
                status: 'operational',
                uptime: Date.now() - this.startTime,
                timestamp: Date.now(),
                endpoints: {
                    schema: '/api/_schema',
                    database: '/api/_database',
                    relations: '/api/_relations',
                    health: '/health',
                    docs: '/docs',
                    swagger: '/swagger.json'
                }
            });
        });

        api.get("/docs", (c) => {
            // Rediriger vers l'endpoint racine
            return c.redirect('/docs', 301);
        });

        this.app.route(`/api/${ConfigManager.APP.API_VERSION}`, api);
        this.app.route("/api", api); // Fallback for backward compatibility

        // Documentation endpoints à la racine
        this.app.get("/docs", (c) => {
            const swaggerUI = `
<!DOCTYPE html>
<html>
<head>
    <title>JamesDbApi Documentation</title>
    <link rel="stylesheet" type="text/css" href="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui.css" />
    <style>
        html { box-sizing: border-box; overflow: -moz-scrollbars-vertical; overflow-y: scroll; }
        *, *:before, *:after { box-sizing: inherit; }
        body { margin:0; background: #fafafa; }
    </style>
</head>
<body>
    <div id="swagger-ui"></div>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-bundle.js"></script>
    <script src="https://unpkg.com/swagger-ui-dist@5.9.0/swagger-ui-standalone-preset.js"></script>
    <script>
        window.onload = function() {
            const ui = SwaggerUIBundle({
                url: '/swagger.json',
                dom_id: '#swagger-ui',
                deepLinking: true,
                presets: [
                    SwaggerUIBundle.presets.apis,
                    SwaggerUIStandalonePreset
                ],
                plugins: [
                    SwaggerUIBundle.plugins.DownloadUrl
                ],
                layout: "StandaloneLayout",
                tryItOutEnabled: true,
                requestInterceptor: (request) => {
                    request.headers['Content-Type'] = 'application/json';
                    return request;
                }
            });
        };
    </script>
</body>
</html>`;
            return c.html(swaggerUI);
        });

        this.app.get("/swagger.json", (c) => {
            const spec = generateSwaggerSpec();
            return c.json(spec);
        });

        // Root endpoint
        this.app.get("/", (c) => {
            const appInfo = ConfigManager.getAppInfo();
            return c.json({
                message: "Welcome to JamesDBBApi",
                ...appInfo,
                documentation: "/docs",
                api: "/api",
                health: "/health",
                swagger: "/swagger.json",
                timestamp: Date.now()
            });
        });

        // Health check endpoint
        this.app.get("/health", async (c) => {
            try {
                const dbHealth = this.dbManager.getHealthStatus();
                const allHealthy = Object.values(dbHealth).every(status => status);

                return c.json({
                    status: allHealthy ? 'healthy' : 'degraded',
                    timestamp: Date.now(),
                    uptime: Date.now() - this.startTime,
                    version: ConfigManager.APP.API_VERSION,
                    databases: dbHealth,
                    memory: process.memoryUsage()
                }, allHealthy ? 200 : 503);
            } catch (error) {
                return c.json({
                    status: 'unhealthy',
                    error: 'Health check failed',
                    timestamp: Date.now()
                }, 503);
            }
        });

        // Metrics endpoint (basic)
        this.app.get("/metrics", (c) => {
            const memUsage = process.memoryUsage();
            const dbCount = this.dbManager.getDatabaseNames().length;

            return c.json({
                system: {
                    uptime: Date.now() - this.startTime,
                    memory: {
                        used: Math.round(memUsage.heapUsed / 1024 / 1024),
                        total: Math.round(memUsage.heapTotal / 1024 / 1024),
                        external: Math.round(memUsage.external / 1024 / 1024)
                    },
                    databases: {
                        total: dbCount,
                        healthy: Object.values(this.dbManager.getHealthStatus()).filter(s => s).length
                    }
                },
                environment: ConfigManager.APP.ENV,
                timestamp: Date.now()
            });
        });

        // 404 handler
        this.app.notFound((c) => {
            return c.json({
                error: 'Not Found',
                message: 'The requested endpoint does not exist',
                available_endpoints: ['/api', '/docs', '/health', '/metrics'],
                timestamp: Date.now()
            }, 404);
        });
    }

    private initServer() {
        const port = ConfigManager.APP.PORT;
        const host = ConfigManager.APP.HOST;

        serve(
            {
                fetch: this.app.fetch,
                port,
                ...(ConfigManager.isProduction() ? { hostname: host } : {})
            },
            (info) => {
                if (info) {
                    this.logger.error('Server startup error:', info);
                    if (ConfigManager.isProduction()) {
                        process.exit(1);
                    }
                }
            }
        );

        const startupTime = Date.now() - this.startTime;
        this.logger.info(`🚀 Server started in ${startupTime}ms`);
        this.logger.info(`🌐 Listening at http://${host}:${port}`);
        this.logger.info(`📦 Environment: ${ConfigManager.APP.ENV}`);
        if (this.dbManager.getDatabaseNames().length > 0)
            this.logger.info(`🗄️  Databases: ${this.dbManager.getDatabaseNames().join(', ')}`);

        // Graceful shutdown
        const gracefulShutdown = async (signal: string) => {
            this.logger.info(`Received ${signal}, starting graceful shutdown...`);
            try {
                await this.dbManager.disconnectAll();
                this.logger.info('Graceful shutdown completed successfully');
                process.exit(0);
            } catch (error: any) {
                // En cas d'erreur lors de la fermeture, on log mais on continue l'arrêt
                this.logger.warn('Warning during shutdown (non-critical):', error?.message || error);
                this.logger.info('Shutdown completed with warnings');
                process.exit(0); // Sortie normale malgré les avertissements
            }
        };

        process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
        process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    }
}

new App();