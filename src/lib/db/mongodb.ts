/*
 * mongodb.ts — MongoDB Atlas connection singleton.
 *
 * MPD Task DB-01:
 *   "MongoDB connection singleton using Mongoose. Caches the connection
 *   on the global object to prevent multiple connections during hot-reload
 *   in development. Reads MONGODB_URI from environment."
 *
 * MPD Section 8, Technical Architecture — Database:
 *   "MongoDB Atlas (M0 free tier for development, M10+ for production).
 *   Mongoose ODM for schema validation and typed queries.
 *   Connection pooling: Next.js serverless functions reuse connections
 *   via global cache."
 *
 * WHY A SINGLETON:
 *   Next.js runs in two distinct environments:
 *
 *   1. DEVELOPMENT (next dev):
 *      Hot Module Replacement (HMR) re-executes module code on every
 *      file save. Without a global cache, each HMR cycle creates a new
 *      Mongoose connection, exhausting the MongoDB Atlas connection pool
 *      within minutes of development.
 *
 *   2. PRODUCTION (next build + start / Vercel):
 *      Each serverless function invocation may reuse an existing Node.js
 *      process. The global cache ensures the existing connection is reused
 *      rather than creating a new one per request, keeping latency low.
 *
 * HOW THE CACHE WORKS:
 *   Node.js `global` persists across module re-imports in the same process.
 *   We store { conn, promise } on global._mongooseCache:
 *     - conn:    the resolved Mongoose connection (null until first connect)
 *     - promise: the in-flight connection promise (null after resolution)
 *
 *   On each connectDB() call:
 *     - If conn exists → return immediately (already connected)
 *     - If promise exists → await it (connection in progress)
 *     - Otherwise → create a new connection promise and cache it
 *
 * TYPESCRIPT GLOBAL AUGMENTATION:
 *   TypeScript does not know about _mongooseCache on the Node.js global.
 *   We augment the NodeJS.Global interface to add it.
 *   This is placed in this file (not a .d.ts) to keep it co-located
 *   with the only code that uses it.
 *
 * MONGOOSE OPTIONS:
 *   bufferCommands: false — fail fast if called before connection is ready.
 *     Without this, Mongoose silently buffers operations that may never
 *     complete. Failing fast surfaces connection issues immediately.
 *   serverSelectionTimeoutMS: 10000 — fail after 10 seconds if Atlas
 *     cannot be reached. Prevents indefinite hanging in serverless.
 *   socketTimeoutMS: 45000 — close idle sockets after 45 seconds.
 *     Serverless functions are short-lived — long-lived idle sockets
 *     waste Atlas connection pool slots.
 *   maxPoolSize: 10 — maximum connections in the pool.
 *     Next.js serverless functions are concurrent — a pool of 10 covers
 *     typical traffic without exhausting the Atlas M0 free tier limit (500).
 *   family: 4 — force IPv4 to avoid DNS resolution issues in some
 *     cloud environments (Vercel, Railway) that prefer IPv4.
 *
 * ENVIRONMENT:
 *   MONGODB_URI is read from process.env at connection time (not at
 *   module load time) to support environments where env vars are
 *   injected after module initialisation (e.g. Vercel Edge Config).
 *
 * USAGE — in an API Route Handler (DB-05):
 *   import connectDB from '@/lib/db/mongodb'
 *
 *   export async function GET() {
 *     await connectDB()
 *     const bikes = await Bike.find({ status: 'published' })
 *     return NextResponse.json({ bikes })
 *   }
 *
 * USAGE — in a Server Component (DB-08):
 *   import connectDB from '@/lib/db/mongodb'
 *
 *   export default async function BrandPage() {
 *     await connectDB()
 *     const bikes = await Bike.find({ brandSlug: 'royal-enfield' })
 *     return <BikeGrid bikes={bikes} />
 *   }
 *
 * NOT USED IN:
 *   - Client Components ('use client') — never access MongoDB client-side
 *   - Middleware (middleware.ts) — middleware runs on the Edge Runtime
 *     which does not support Node.js native modules (mongoose requires Node.js)
 */

import mongoose, { type Mongoose } from 'mongoose'

// ---------------------------------------------------------------------------
// TypeScript Global Augmentation
// ---------------------------------------------------------------------------

/*
 * Augment the NodeJS.Global interface to include our Mongoose cache.
 * This prevents TypeScript errors when reading/writing global._mongooseCache.
 *
 * Placed in this file (not a separate .d.ts) because:
 *   1. It is only used here — co-location reduces cognitive overhead.
 *   2. A separate .d.ts would require tsconfig paths configuration.
 *   3. Next.js picks up ambient declarations in .ts files automatically.
 *
 * The `var` declaration inside `declare global` is intentional —
 * TypeScript requires `var` (not `let`/`const`) for global augmentation.
 */
declare global {
  // eslint-disable-next-line no-var
  var _mongooseCache: MongooseCache | undefined
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/*
 * MongooseCache — shape of the global connection cache.
 *
 * conn:    the resolved Mongoose instance after successful connection.
 *          null before the first connection or if disconnected.
 *
 * promise: the in-flight Promise<Mongoose> during initial connection.
 *          null before connection starts and after it resolves.
 *          Caching the promise prevents duplicate connections when
 *          multiple requests arrive before the first connection resolves.
 */
interface MongooseCache {
  conn: Mongoose | null
  promise: Promise<Mongoose> | null
}

/*
 * MongooseConnectionOptions — subset of Mongoose ConnectOptions
 * that we explicitly configure.
 * Typed here for documentation — passed directly to mongoose.connect().
 */
interface MongooseConnectionOptions {
  bufferCommands: boolean
  serverSelectionTimeoutMS: number
  socketTimeoutMS: number
  maxPoolSize: number
  family: number
}

// ---------------------------------------------------------------------------
// Mongoose connection options
// ---------------------------------------------------------------------------

const CONNECTION_OPTIONS: MongooseConnectionOptions = {
  /*
   * bufferCommands: false — Mongoose will not buffer commands when the
   * connection is down. Operations fail immediately with a clear error
   * instead of hanging indefinitely waiting for reconnection.
   * This is the correct behaviour for serverless where a down connection
   * means the function should fail fast and retry on the next request.
   */
  bufferCommands: false,

  /*
   * serverSelectionTimeoutMS: 10000 — Maximum time (10s) Mongoose waits
   * for MongoDB Atlas to respond before throwing a timeout error.
   * Default is 30s — too long for serverless functions which have a
   * hard execution limit. 10s provides enough time for Atlas cold start
   * while failing fast enough to not block the request indefinitely.
   */
  serverSelectionTimeoutMS: 10_000,

  /*
   * socketTimeoutMS: 45000 — Close idle sockets after 45 seconds.
   * Prevents stale connections from consuming Atlas connection slots.
   * Set higher than serverSelectionTimeoutMS to avoid premature closes.
   */
  socketTimeoutMS: 45_000,

  /*
   * maxPoolSize: 10 — Maximum simultaneous MongoDB connections per
   * Node.js process. A pool of 10 handles concurrent API requests
   * without exhausting Atlas M0 free tier (500 connection limit).
   * For production on Vercel with multiple serverless instances,
   * consider reducing to 5 to stay well within Atlas limits.
   */
  maxPoolSize: 10,

  /*
   * family: 4 — Force IPv4 DNS resolution.
   * Some cloud environments (Vercel, Railway, Render) have IPv6
   * connectivity issues with MongoDB Atlas SRV records.
   * IPv4 is always available and avoids DNS resolution failures.
   */
  family: 4,
}

// ---------------------------------------------------------------------------
// Global cache initialisation
// ---------------------------------------------------------------------------

/*
 * Initialise the global cache if it does not already exist.
 *
 * global._mongooseCache persists across:
 *   - Module re-imports (Next.js HMR in development)
 *   - Subsequent requests to the same serverless function instance
 *   - Multiple API routes in the same process
 *
 * It does NOT persist across:
 *   - Process restarts (cold starts on Vercel)
 *   - Different serverless function instances
 */
if (!global._mongooseCache) {
  global._mongooseCache = {
    conn: null,
    promise: null,
  }
}

/*
 * Local reference to the global cache.
 * This reference is stable for the lifetime of the module — the
 * global object property may be re-assigned but this reference
 * always points to the same cache object.
 */
const cache: MongooseCache = global._mongooseCache

// ---------------------------------------------------------------------------
// connectDB
// ---------------------------------------------------------------------------

/*
 * connectDB — establishes and caches a MongoDB Atlas connection.
 *
 * Returns the Mongoose instance (connected).
 * Subsequent calls return the cached connection immediately.
 *
 * Throws if:
 *   - MONGODB_URI is not set in the environment
 *   - MongoDB Atlas is unreachable (network error, wrong URI)
 *   - Authentication fails (wrong username/password in URI)
 *   - Connection times out (serverSelectionTimeoutMS exceeded)
 *
 * CALL PATTERN:
 *   Always await connectDB() before any Mongoose Model operation.
 *   The function is idempotent — calling it multiple times is safe.
 *
 * ERROR HANDLING:
 *   Errors propagate to the caller (API Route or Server Component).
 *   The caller should catch and return an appropriate HTTP error response.
 *   connectDB itself does not swallow errors — it is the caller's
 *   responsibility to handle them gracefully.
 */
async function connectDB(): Promise<Mongoose> {
  /*
   * Fast path — already connected in this process.
   * Return the existing connection immediately.
   */
  if (cache.conn !== null) {
    return cache.conn
  }

  /*
   * In-flight path — connection is in progress from a concurrent request.
   * Await the existing promise instead of creating a duplicate connection.
   */
  if (cache.promise !== null) {
    cache.conn = await cache.promise
    return cache.conn
  }

  /*
   * Read MONGODB_URI from environment at connection time.
   *
   * Reading at connection time (not at module load time) supports:
   *   - Vercel environment variable injection after module load
   *   - Test environments that set env vars after import
   *   - dotenv-based setups where vars are loaded asynchronously
   */
  const uri = process.env.MONGODB_URI
  console.log(process.env.MONGODB_URI)
  if (!uri) {
    throw new Error(
      '[MotoHub360] MONGODB_URI is not set.\n' +
        'Add MONGODB_URI to your .env.local file:\n' +
        'MONGODB_URI=mongodb+srv://[user]:[password]@[cluster].mongodb.net/motohub360',
    )
  }

  /*
   * Cold path — create a new connection promise and cache it.
   *
   * We cache the PROMISE (not the resolved connection) immediately.
   * This handles the race condition where multiple requests arrive
   * simultaneously before any connection is established:
   *   Request 1: cache.promise = null → creates promise, caches it
   *   Request 2: cache.promise !== null → awaits the same promise
   *   Request 3: cache.promise !== null → awaits the same promise
   * Only one connection is ever created regardless of concurrency.
   */
  cache.promise = mongoose
    .connect(uri, CONNECTION_OPTIONS)
    .then((mongooseInstance) => {
      /*
       * Connection successful.
       * Store the resolved connection and clear the promise reference.
       * Future calls hit the fast path (cache.conn !== null).
       */
      cache.conn = mongooseInstance
      cache.promise = null

      if (process.env.NODE_ENV === 'development') {
        console.log('[MotoHub360] MongoDB connected successfully.')
      }

      return mongooseInstance
    })
    .catch((error: unknown) => {
      /*
       * Connection failed.
       * Clear both cache entries so the next call retries.
       * If we left cache.promise set, all future calls would await
       * a rejected promise and always fail.
       */
      cache.conn = null
      cache.promise = null

      if (process.env.NODE_ENV === 'development') {
        console.error('[MotoHub360] MongoDB connection failed:', error)
      }

      /*
       * Re-throw so the caller (API Route / Server Component) can
       * handle the error and return an appropriate HTTP response.
       */
      throw error
    })

  /*
   * Await the newly created promise.
   * If another call arrives while this is in flight, it will find
   * cache.promise !== null and await the same promise (in-flight path).
   */
  cache.conn = await cache.promise
  return cache.conn
}

// ---------------------------------------------------------------------------
// Mongoose event listeners (development only)
// ---------------------------------------------------------------------------

/*
 * Log Mongoose connection events in development for debugging.
 * These listeners are attached once per process (not per connectDB call)
 * because mongoose.connection is a singleton.
 *
 * The NODE_ENV guard prevents these logs appearing in production builds
 * where console output is a performance concern.
 */
if (process.env.NODE_ENV === 'development') {
  mongoose.connection.on('connected', () => {
    console.log('[MotoHub360] Mongoose connection state: connected')
  })

  mongoose.connection.on('disconnected', () => {
    console.log('[MotoHub360] Mongoose connection state: disconnected')
  })

  mongoose.connection.on('error', (err: Error) => {
    console.error('[MotoHub360] Mongoose connection error:', err.message)
  })
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

/*
 * Default export: connectDB function.
 * Named export: MongooseCache type (for testing utilities in future).
 *
 * Usage:
 *   import connectDB from '@/lib/db/mongodb'
 *   await connectDB()
 */
export type { MongooseCache }
export default connectDB