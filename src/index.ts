/**
 * IMPORTANT:
 * ---------
 * Do not manually edit this file if you'd like to host your server on Colyseus Cloud
 *
 * If you're self-hosting (without Colyseus Cloud), you can manually
 * instantiate a Colyseus Server as documented here:
 *
 * See: https://docs.colyseus.io/server/api/#constructor-options
 */
import { listen } from "@colyseus/tools";

// Import Colyseus config
import app from "./app.config";
import { logger, serializeUnknownError } from "./logger";

// Create and listen on 2567 (or PORT environment variable.)
process.on("unhandledRejection", (reason) => {
	logger.error("Unhandled promise rejection", { reason: serializeUnknownError(reason) });
});

process.on("uncaughtException", (error) => {
	logger.error("Uncaught exception", { error: serializeUnknownError(error) });
	process.exit(1);
});

try {
	listen(app);
	logger.info("Server listen initialized", { port: process.env.PORT ?? 2567 });
} catch (error) {
	logger.error("Failed to initialize server listen", { error: serializeUnknownError(error) });
	process.exit(1);
}
