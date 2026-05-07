import mongoose from "mongoose";
import { perfElapsed, perfLog, perfNow } from "@/lib/perf-debug";

/** Logical database name (MongoDB URI may also specify db; this matches existing behavior). */
export const DB_NAME = "anjal_achievements";

const MONGODB_URI_RAW = process.env.MONGODB_URI?.trim();

if (!MONGODB_URI_RAW) {
  throw new Error("Please define the MONGODB_URI environment variable");
}

const MONGODB_URI = MONGODB_URI_RAW;

declare global {
  var mongooseCache:
    | {
        conn: typeof mongoose | null;
        promise: Promise<typeof mongoose> | null;
      }
    | undefined;
  var __stMongooseListenersAttached: boolean | undefined;
}

const cached = global.mongooseCache ?? { conn: null, promise: null };
global.mongooseCache = cached;

/** Strip credentials from Mongo URI for logs only */
export const maskMongoUriForLogs = (uri: string): string =>
  uri.replace(/\/\/([^:@/]+):([^@/]+)@/i, "//***:***@");

/** Host portion for diagnostics (no credentials) */
export const getMongoHostForLogs = (uri: string): string => {
  const m = uri.match(/@([^/?]+)/);
  return m?.[1]?.trim() || "(unknown-host)";
};

const MONGO_OPTIONS: mongoose.ConnectOptions = {
  dbName: DB_NAME,
  serverSelectionTimeoutMS: 15_000,
  connectTimeoutMS: 15_000,
  socketTimeoutMS: 30_000,
  maxPoolSize: 10,
  minPoolSize: 1,
};

const attachListenersOnce = () => {
  if (global.__stMongooseListenersAttached) return;
  global.__stMongooseListenersAttached = true;

  mongoose.connection.on("disconnected", () => {
    console.warn("[db:event:disconnected]", {
      readyState: mongoose.connection.readyState,
    });
    cached.conn = null;
    cached.promise = null;
  });

  mongoose.connection.on("error", (err: Error) => {
    console.error("[db:event:connection_error]", {
      message: err.message,
      errorName: err.name,
      readyState: mongoose.connection.readyState,
    });
  });
};

const resetConnectionCache = () => {
  cached.conn = null;
  cached.promise = null;
};

const isStaleOrDisconnecting = (readyState: number): boolean =>
  readyState === 0 || readyState === 3;

export const logDbReadyState = (label: string): void => {
  console.log(`[db:readyState:${label}]`, {
    readyState: mongoose.connection.readyState,
    mongoHost: getMongoHostForLogs(MONGODB_URI),
    dbName: mongoose.connection.name || DB_NAME,
  });
};

/**
 * Returns true if admin ping succeeds. Requires an established connection (call {@link connectDB} first).
 */
export async function pingMongo(): Promise<boolean> {
  try {
    const rs = mongoose.connection.readyState;
    if (rs !== 1) {
      console.error("[db:ping:failed]", {
        reason: "not_connected",
        readyState: rs,
      });
      return false;
    }
    const db = mongoose.connection.db;
    if (!db) {
      console.error("[db:ping:failed]", { reason: "no_db_handle", readyState: rs });
      return false;
    }
    await db.admin().command({ ping: 1 });
    console.log("[db:ping:ok]", {
      readyState: mongoose.connection.readyState,
      mongoHost: getMongoHostForLogs(MONGODB_URI),
    });
    return true;
  } catch (error) {
    const err = error instanceof Error ? error : new Error(String(error));
    const code = (error as NodeJS.ErrnoException)?.code;
    console.error("[db:ping:failed]", {
      message: err.message,
      errorName: err.name,
      errorCode: code ?? undefined,
      stack: err.stack,
      readyState: mongoose.connection.readyState,
    });
    return false;
  }
}

export async function connectDB(): Promise<typeof mongoose> {
  attachListenersOnce();

  const mongoHost = getMongoHostForLogs(MONGODB_URI);
  const uriMasked = maskMongoUriForLogs(MONGODB_URI);

  if (mongoose.connection.readyState === 1) {
    cached.conn = mongoose;
    return mongoose;
  }

  // Drop stale cached handles only when disconnected / disconnecting (not while connecting: state 2)
  const rsStale = mongoose.connection.readyState;
  if (cached.conn && (rsStale === 0 || rsStale === 3)) {
    console.warn("[db:stale_cache_clear]", {
      readyState: rsStale,
      mongoHost,
    });
    resetConnectionCache();
  }

  if (isStaleOrDisconnecting(mongoose.connection.readyState)) {
    console.warn("[db:reconnect:needed]", {
      readyState: mongoose.connection.readyState,
      mongoHost,
    });
    resetConnectionCache();
    try {
      await mongoose.disconnect();
    } catch {
      /* ignore */
    }
  }

  if (!cached.promise) {
    const t0 = perfNow();
    console.log("[db:connect:start]", {
      nodeEnv: process.env.NODE_ENV ?? "(unset)",
      hasMongoUri: true,
      mongoHost,
      mongoUriMasked: uriMasked,
      dbName: DB_NAME,
      readyStateBefore: mongoose.connection.readyState,
    });

    cached.promise = mongoose
      .connect(MONGODB_URI, MONGO_OPTIONS)
      .then((m) => {
        perfElapsed("db:firstConnect", t0);
        console.log("[db:connect:success]", {
          nodeEnv: process.env.NODE_ENV ?? "(unset)",
          hasMongoUri: true,
          mongoHost,
          dbName: mongoose.connection.name || DB_NAME,
          readyState: mongoose.connection.readyState,
          mongoUriMasked: uriMasked,
        });
        return m;
      })
      .catch((error: unknown) => {
        const err = error instanceof Error ? error : new Error(String(error));
        const code = (error as NodeJS.ErrnoException)?.code;
        console.error("[db:connect:failed]", {
          nodeEnv: process.env.NODE_ENV ?? "(unset)",
          hasMongoUri: true,
          mongoHost,
          dbName: DB_NAME,
          mongoUriMasked: uriMasked,
          readyState: mongoose.connection.readyState,
          errorName: err.name,
          errorMessage: err.message,
          errorCode: code ?? undefined,
          stack: err.stack,
        });
        resetConnectionCache();
        throw error;
      });
  }

  try {
    cached.conn = await cached.promise;
    return cached.conn;
  } catch (error) {
    resetConnectionCache();
    throw error;
  }
}
