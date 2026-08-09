/**
 * Values shared with the middleware.
 *
 * Kept free of node: imports on purpose — middleware runs on the edge runtime,
 * and importing session.ts there would drag node:crypto in with it.
 */
export const SESSION_COOKIE = "mcp_session";
