import { Hono } from "hono";
import { AuthManager } from "../middlewares/auth";

var authManager = AuthManager.getInstance();
var _auth = new Hono();

// _auth.get("/login", (c) => {
//     var refreshToken = c.req.header("Refresh-Token");
//     if (refreshToken) {
//         return authManager.login(c, refreshToken);
//     }
//     return c.json({ error: "Refresh token is required" }, 400);
// });