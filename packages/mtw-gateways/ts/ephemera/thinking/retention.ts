import type { ThinkingScheduleStatus } from '@tonylb/mtw-interfaces/ts/eventBridge/ephemera/thinking'

/** Completed jobs older than this are excluded from subscribe snapshots. */
export const THINKING_SNAPSHOT_COMPLETED_MAX_AGE_MS = 8 * 60 * 60 * 1000

/** Dynamo TTL offset after a row's terminal instant (snapshot window + buffer). */
export const THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS = 9 * 60 * 60 * 1000

const TERMINAL_SCHEDULE_STATUSES: ReadonlySet<ThinkingScheduleStatus> = new Set([
    'completed',
    'cancelled',
])

export const isTerminalThinkingScheduleStatus = (status: string): status is ThinkingScheduleStatus =>
    TERMINAL_SCHEDULE_STATUSES.has(status as ThinkingScheduleStatus)

/**
 * ISO-8601 cutoff for GSI filter: `completedAt > :cutoff` on completed Meta::Job rows.
 */
export const thinkingSnapshotCompletedCutoffIso = (nowMs: number = Date.now()): string =>
    new Date(nowMs - THINKING_SNAPSHOT_COMPLETED_MAX_AGE_MS).toISOString()

/**
 * Dynamo TTL attribute (Unix epoch seconds) from a terminal ISO-8601 timestamp.
 */
export const thinkingDeleteAtFromTerminalIso = (terminalAtIso: string, nowMs: number = Date.now()): number => {
    const parsedMs = Date.parse(terminalAtIso)
    const baseMs = Number.isFinite(parsedMs) ? parsedMs : nowMs
    return Math.floor((baseMs + THINKING_DYNAMO_TTL_AFTER_TERMINAL_MS) / 1000)
}
