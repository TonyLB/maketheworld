import { wholeMembersOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import { isEphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import { readRoomCharacters } from '../../ludicCache/charactersRow'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { streamEventFromMessageBus } from '../../publishedEvents'
import { commitStepSequence } from '../kernel/commitStepSequence'
import { migrateBaseBinding } from './migrateBaseBinding'
import type { PopulateContainmentAtCacheDependencies } from './populateContainmentAtCache'

/**
 * Runs the Base migration (`migrateBaseBinding`) for one whole against freshly read graphs: its own,
 * every member's, and a Room's present characters from the characters row. Reads every member before
 * planning, because a partial read would leave a member uncovered; if any cannot be read it writes
 * nothing. A whole already migrated (or not migratable yet) plans no step and commits nothing, so a
 * redelivered finding is a no-op.
 *
 * Runs before population in `healContainmentPopulation`, which then reads the parent with its Base.
 *
 * **Never call this from a read path.** It is a write-carrying repair, run only from the finding
 * consumer or a manual invocation.
 */
export const migrateBaseAtCache = async (
    wholeId: EphemeraMembershipHostId,
    deps: PopulateContainmentAtCacheDependencies
): Promise<void> => {
    const wholeGraph = await internalCache.Positions.getLudicGraph(wholeId)
    const graphs = new Map<EphemeraMembershipHostId, EphemeraLudicGraph>()
    const members = wholeMembersOf({ hostId: wholeId, nodeIds: [...wholeGraph.nodeIds], presenceNodes: wholeGraph.presenceNodes })
    for (const memberId of members) {
        if (!isEphemeraMembershipHostId(memberId)) {
            continue
        }
        try {
            graphs.set(memberId, await internalCache.Positions.getLudicGraph(memberId))
        } catch (error) {
            console.error(`[mtw.ephemera.positions] migrateBaseAtCache aborted for ${wholeId}: could not read ${memberId}`)
            return
        }
    }
    const bystanders = isEphemeraRoomId(wholeId) ? await readRoomCharacters(wholeId) : []

    const steps = migrateBaseBinding(wholeGraph, (memberId) => graphs.get(memberId), bystanders)
    if (steps.length === 0) {
        return
    }
    const result = await commitStepSequence(
        { steps },
        {
            messageBus: deps.messageBus,
            streamEvent: deps.streamEvent ?? streamEventFromMessageBus(deps.messageBus),
            getCurrentHost: () => wholeId,
        }
    )
    if (!result.ok) {
        console.error(`[mtw.ephemera.positions] migrateBaseAtCache failed for ${wholeId}: ${result.errorMessage}`)
    }
}
