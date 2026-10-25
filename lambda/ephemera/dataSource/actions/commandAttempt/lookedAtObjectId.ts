import { isEphemeraObjectId, type EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { CommandAttemptData } from '.'
import { objectSpansIn } from './referent'

/**
 * The object a look attempt names, or undefined if the attempt is not a look. A look is an attempt
 * whose primary (last) action narrates; a qualified look carries assertion actions ahead of it, which
 * the dry run already judged and nothing executes. The looked-at object is the referent the narration
 * names, by its key, not the attempt's first referent (an assertion names the qualifier's host too).
 */
export const lookedAtObjectIdOf = (attempt: CommandAttemptData): EphemeraObjectId | undefined => {
    const primary = attempt.actions[attempt.actions.length - 1]
    if (primary?.kind !== 'narrate') {
        return undefined
    }
    const [named] = primary.referents.flatMap(objectSpansIn)
    const id = attempt.referents.find(({ refKey }) => refKey === named?.stableRefKey)?.id
    return id !== undefined && isEphemeraObjectId(id) ? id : undefined
}
