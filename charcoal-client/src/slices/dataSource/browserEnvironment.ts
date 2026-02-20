/**
 * Minimal browser DataSourceEnvironment for use in client serializers.
 *
 * Uses global fetch. Structurally compatible with DataSourceEnvironment from
 * @tonylb/mtw-interfaces/ts/DataSourceEnvironment.
 */
export function createBrowserDataSourceEnvironment(): {
  fetch: (url: string, init?: RequestInit) => Promise<Response>;
} {
  return {
    fetch: (url: string, init?: RequestInit) => fetch(url, init),
  };
}
