import { createHash } from 'node:crypto'
import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraCacheMarkState } from '../../renderCache/baseClasses'

/** Bump if canonical mark JSON changes (keeps cohort keys stable across code versions). */
const MARK_STATE_CANON_VERSION = 'm1' as const

/**
 * Stable cohort key for {@link singleFlight} around passive room render generation.
 * Same inputs imply the same logical generation job (OI-1).
 *
 * Mark state is hashed (SHA-256 hex) after canonical JSON so the Dynamo `DataCategory` stays short
 * and collision-resistant; dissimilar mark sets still map to distinct cohorts.
 */
export const computeRenderGenerationArgumentHash = (
    roomId: EphemeraRoomId,
    perspectiveKey: string,
    markState: EphemeraCacheMarkState
): string => {
    const sorted = [...markState.markValue].sort((a, b) => (
        a.mark.localeCompare(b.mark) || a.value.localeCompare(b.value)
    ))
    const canonicalMarkJson = JSON.stringify(sorted)
    const markDigest = createHash('sha256').update(canonicalMarkJson, 'utf8').digest('hex')
    return `${roomId}|${perspectiveKey}|${MARK_STATE_CANON_VERSION}:${markDigest}`
}
