import { Hono } from "hono";

var _database = new Hono();

_database.get("/", (c) => {
    return c.json({
        message: "Database endpoint is active",
        timestamp: Date.now(),
    });
});

export default _database;