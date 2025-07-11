import { Hono } from "hono";

var _schema = new Hono();

_schema.get("/", (c) => {
    return c.json({
        message: "Schema endpoint is active",
        timestamp: Date.now(),
    });
});

export default _schema;