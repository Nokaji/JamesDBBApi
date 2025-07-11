import { Hono } from "hono";
import { isRunningOnBun } from "./utils/runtime";
import ConfigManager from "./managers/ConfigManager";

const { serveStatic } = isRunningOnBun()
    ? await import("hono/bun")
    : await import("@hono/node-server/serve-static");
const { serve } = isRunningOnBun()
    ? await import("bun")
    : await import("@hono/node-server");


class App {
    app: Hono = new Hono();
    startTime: number = Date.now();

    constructor() {
        this.initRoutes();
        this.initServer();
    };
    private initRoutes() {
        // Route de test pour vérifier que l'API fonctionne
        this.app.get("/", (c) => {
            return c.json({
                message: "James DB API is running!",
                graphqlEndpoint: "/graphql",
                version: "1.0.0",
                uptime: Date.now() - this.startTime,
                database: "SQLite with Prisma ORM",
                features: [
                    "GraphQL API with Yoga",
                    "User management",
                    "Post management",
                    "GraphiQL interface"
                ]
            });
        });
    };

    private initServer() {
        serve(
            { fetch: this.app.fetch, port: ConfigManager.APP.PORT, hostname: ConfigManager.APP.HOST },
            async (err: any) => {
                if (err) {
                    console.error(err);
                    if (ConfigManager.APP.ENV === "developement") process.exit(1);
                }
            }
        );

        const elapsedMilliseconds = Date.now() - this.startTime;
        console.log(
            `Server started in ${elapsedMilliseconds} milliseconds, listening at http://${ConfigManager.APP.HOST}:${ConfigManager.APP.PORT}`
        );
    };
}

new App();