import { isEphemeraRoomId, type EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttemptData } from '.'
import { objectSpansIn } from './referent'

/**
 * Where a navigation attempt goes: the room its navigate action's exit grounded to, and the exit's
 * name; undefined if the attempt is not a navigation. The dry run already judged that the exit is
 * here; dispatch rechecks it against the exits it streams from.
 */
export const navigationTargetOf = (attempt: CommandAttemptData): { targetId: EphemeraRoomId; exitName?: string } | undefined => {
    const navigate = attempt.kind === 'navigation' ? attempt.actions.find((action) => action.kind === 'navigate') : undefined
    if (navigate?.kind !== 'navigate') {
        return undefined
    }
    const [destination] = objectSpansIn(navigate.destination)
    const targetId = destination?.groundedId
    if (targetId === undefined || !isEphemeraRoomId(targetId)) {
        return undefined
    }
    return { targetId, ...(destination.shortName !== undefined ? { exitName: destination.shortName } : {}) }
}
