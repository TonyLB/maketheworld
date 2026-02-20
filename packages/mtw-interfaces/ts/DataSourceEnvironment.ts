/**
 * Environment contract for DataSource resolution (e.g. sidecar fetch).
 *
 * Serializers use this so the same resolution logic can run in both backend
 * (Node/lambda) and client (browser). Only fetch is required; it is the one
 * capability that meaningfully differs between runtimes.
 *
 * @example Backend: Node `fetch` or AWS SDK as needed for presigned URLs.
 * @example Client: Browser `fetch`.
 */
export interface DataSourceEnvironment {
    /** Fetch a URL; used when resolving sidecar descriptors (e.g. presigned S3 GET). */
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
}
