export const PERSISTENT_COMMAND_TTL_MS = 60 * 60 * 1000

/** Dynamo TTL attribute (Unix epoch seconds) for a row written at `nowMs`. */
export const persistentCommandDeleteAt = (nowMs: number = Date.now()): number => (
    Math.floor((nowMs + PERSISTENT_COMMAND_TTL_MS) / 1000)
)

/** Dynamo may keep an expired row for up to ~48 hours, so reads must treat it as absent. */
export const isPersistentCommandExpired = (row: { deleteAt?: number }, nowMs: number = Date.now()): boolean => (
    typeof row.deleteAt === 'number' && row.deleteAt <= Math.floor(nowMs / 1000)
)
