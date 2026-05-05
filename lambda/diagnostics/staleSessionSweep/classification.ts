/**
 * Slack beyond `dropAfter` before treating a session meta row as stale for diagnostics.
 * Aligns with initiative D4: disconnect schedules ~4s `dropAfter`, Step Functions waits ~5s before
 * `checkSession`, plus clock skew — emit only after this buffer to avoid false positives.
 */
export const STALE_BUFFER_MS = 12_000

export const hasActiveConnections = (connections?: string[]): boolean =>
    Array.isArray(connections) && connections.length > 0

/**
 * True when the Meta::Session row indicates no active WebSocket connections and the disconnect
 * grace window (plus buffer) has elapsed, or when connections are empty but `dropAfter` was never set (anomaly).
 */
export const isStaleSessionMetaRow = (args: {
    connections?: string[]
    dropAfter?: number
    nowMs: number
}): boolean => {
    const { connections, dropAfter, nowMs } = args
    if (hasActiveConnections(connections)) {
        return false
    }
    if (typeof dropAfter !== 'number') {
        return true
    }
    return nowMs > dropAfter + STALE_BUFFER_MS
}
