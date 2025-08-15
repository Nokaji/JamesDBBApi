import { RedisManager } from "../middlewares/redis";
import { parentPort } from "worker_threads";
import configManager from "../utils/config";

let redisManager: RedisManager;
let instanceId: string;

// Écouter les messages du thread principal
parentPort?.on("message", (data) => {
    if (data.type === "INIT" && data.instanceId) {
        instanceId = data.instanceId;
        redisManager = RedisManager.getInstance();
        startHeartbeat();
    }
});

function startHeartbeat() {
    setInterval(async () => {
        try {
            if (redisManager && instanceId) {
                // Utiliser l'ID reçu du thread principal
                const client = await redisManager.getClient();
                const channelPrefix = redisManager.getChannelPrefix();
                client.expire(channelPrefix + 'instances:' + instanceId, 15);
                if (configManager.APP.DEBUG) {
                    console.log("Refreshed Redis instance:", instanceId);
                }
            }
        } catch (error) {
            console.error("Error sending heartbeat:", error);
        }
    }, 5000);
}