/**
 * Mongo connection entry — implementation lives in {@link ./db}.
 */
export { connectDB as default, pingMongo, logDbReadyState, DB_NAME, maskMongoUriForLogs, getMongoHostForLogs } from "./db";
