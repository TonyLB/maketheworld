/**
 * Per-field sidecar resolution for DataSource serializers.
 *
 * When an external payload field can be either inline (e.g. a string) or a sidecar
 * descriptor (e.g. `{ sidecarUrl: string }`), this helper resolves to the string
 * content before parsing. Use Node's native `fetch` by default; inject for tests
 * or future DataSourceEnvironment.
 *
 * @module sidecarResolve
 */

/**
 * Resolve a value to a string, fetching from sidecar URL if needed.
 *
 * - If `value` is an object with `sidecarUrl: string`, fetches the URL and returns
 *   the response body as text.
 * - Otherwise, coerces `value` to string (inline case).
 *
 * @param value - Inline string or sidecar descriptor `{ sidecarUrl: string }`
 * @param fetchFn - Optional fetch implementation (default: global fetch). Use for
 *   tests or when injecting DataSourceEnvironment. Accepts (url: string, init?) so
 *   DataSourceEnvironment.fetch is compatible.
 * @returns Promise resolving to the string content
 * @throws Re-throws fetch errors (network failures, non-2xx responses, etc.)
 */
export async function maybeFetchSidecarString(
    value: unknown,
    fetchFn: (url: string, init?: RequestInit) => Promise<Response> = fetch
): Promise<string> {
    if (
        value != null &&
        typeof value === 'object' &&
        'sidecarUrl' in value &&
        typeof (value as { sidecarUrl: unknown }).sidecarUrl === 'string'
    ) {
        const url = (value as { sidecarUrl: string }).sidecarUrl
        const response = await fetchFn(url)
        if (!response.ok) {
            throw new Error(
                `Sidecar fetch failed: ${response.status} ${response.statusText} (${url})`
            )
        }
        return response.text()
    }
    if (value == null) {
        return ''
    }
    return String(value)
}
