import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttemptData } from '.'
import { objectSpansIn } from './referent'

/**
 * The object a look attempt names, or undefined if the attempt is not a look. A qualified look
 * carries assertion actions beside its narration, which the dry run already judged and nothing
 * executes. The looked-at object is the referent the narration names, by its key, not the
 * attempt's first referent (an assertion names the qualifier's host too).
 */
export const lookedAtObjectIdOf = (attempt: CommandAttemptData): EphemeraObjectId | undefined => {
    const narration = attempt.kind === 'look' ? attempt.actions.find((action) => action.kind === 'narrate') : undefined
    if (narration?.kind !== 'narrate') {
        return undefined
    }
    const [named] = narration.referents.flatMap(objectSpansIn)
    const id = attempt.referents.find(({ refKey }) => refKey === named?.stableRefKey)?.id
    return id !== undefined && isEphemeraObjectId(id) ? id : undefined
}
