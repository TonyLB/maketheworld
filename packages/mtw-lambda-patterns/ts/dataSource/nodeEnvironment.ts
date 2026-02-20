/**
 * Minimal Node/lambda DataSourceEnvironment for use in backend serializers.
 *
 * Uses global fetch (Node 18+). Structurally compatible with DataSourceEnvironment
 * from @tonylb/mtw-interfaces/ts/DataSourceEnvironment; this package does not
 * depend on mtw-interfaces to avoid circular dependency.
 */
export function createNodeDataSourceEnvironment(): {
    fetch: (url: string, init?: RequestInit) => Promise<Response>;
} {
    return {
        fetch: (url: string, init?: RequestInit) => fetch(url, init),
    };
}
