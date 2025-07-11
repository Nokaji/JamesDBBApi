import { Hono } from "hono";
import { isRunningOnBun } from "./utils/runtime";
import ConfigManager from "./managers/ConfigManager";
import "./routes/_schema.routes"; // Importing the schema routes
import _schema from "./routes/_schema.routes";
import _database from "./routes/_database.routes";
import { etag } from "hono/etag";
import { cors } from "hono/cors";
import { csrf } from "hono/csrf";
import { secureHeaders } from "hono/secure-headers";
import Logging from "./utils/logging";

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

    constructor() {
        this.initRouter();
        this.initServer();
    };
    private initRouter() {
        this.app.use(csrf());
        this.app.use(cors({ origin: [ConfigManager.APP.HOST] }));
        if (ConfigManager.APP.ENV === "production") {
            this.app.use("*", async (c, next) => {
                if (c.req.header("x-forwarded-proto") !== "https") {
                    return c.redirect("https://" + c.req.header("host") + c.req.url, 301);
                }
                return next();
            });
        };

        this.app.use(etag());
        this.app.use(
            "*",
            secureHeaders({
                strictTransportSecurity: "max-age=63072000; includeSubDomains; preload",
                xFrameOptions: "DENY",
                xXssProtection: "1",
            })
        );

        this.app.use(async (c, next) => {
            const contentType = c.req.header('content-type');
            if (c.req.method !== 'GET' && contentType && !contentType.includes('application/json')) {
                return c.json({ error: 'Only JSON content type is allowed' }, 400);
            }
            await next();
        });

        var api = new Hono();
        api.route("/_schema", _schema);
        api.route("/_database", _database);
        this.app.route("/api", api);

        this.app.get("/", (c) => {
            return c.json({
                message: "Welcome to the JamesDbApi",
                timestamp: Date.now(),
            });
        });

    };

    private initServer() {
        serve(
            { fetch: this.app.fetch, port: ConfigManager.APP.PORT },
            async (err: any) => {
                if (err) {
                    console.error(err);
                    if (ConfigManager.APP.ENV === "developement") process.exit(1);
                }
            }
        );

        this.logger.log(
            `Server started in ${Date.now() - this.startTime} milliseconds, listening at http://${ConfigManager.APP.HOST}:${ConfigManager.APP.PORT}`
        );
    };
}

new App();