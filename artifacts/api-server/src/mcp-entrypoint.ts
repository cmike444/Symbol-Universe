import { startMcpServer } from "./mcp/server.js";
import { logger } from "./lib/logger.js";

startMcpServer().catch((err) => {
  logger.error({ err }, "MCP server failed to start");
  process.exit(1);
});
