/**
 * Environment contract for DataSource resolution (e.g. sidecar fetch, logging).
 *
 * Serializers and resolution helpers use this interface so the same logic can run
 * in both backend (Node/lambda) and client (browser). The type must not depend on
 * Node-only or browser-only APIs; implementers supply runtime-appropriate behavior.
 *
 * @example Backend: Use Node `fetch` (or AWS SDK as needed), `getCurrentTimestamp()`
 * (or equivalent) for `now`, and lambda/console logger for `log`.
 * @example Client: Use browser `fetch`, `Date.now()` for `now`, and console or
 * client logger for `log`.
 */
export interface DataSourceEnvironment {
    /** Fetch a URL; used when resolving sidecar descriptors (e.g. presigned S3 GET). */
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
    /** Current time in ms (e.g. for timestamps, expiry). */
    now: () => number;
    /** Log at the given level; meta is optional structured data. */
    log: (level: 'info' | 'warn' | 'error', message: string, meta?: unknown) => void;
}
