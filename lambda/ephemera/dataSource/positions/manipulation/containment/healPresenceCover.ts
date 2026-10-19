import { coverRebuildsFor, orphanRepairsFor, wholeMembersOf } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { PresenceGraphView } from '@tonylb/mtw-gateways/ts/ephemera/positions'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { isEphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import internalCache from '../../../../internalCache'
import type { EphemeraLudicGraph } from '../../ludicGraph'
import { streamEventFromMessageBus } from '../../publishedEvents'
import { commitStepSequence } from '../kernel/commitStepSequence'
import type { MutationKernelRepairPresenceBindingStep } from '../kernel/kernelStep'
import type { PopulateContainmentAtCacheDependencies } from './populateContainmentAtCache'

const viewOf = (graph: EphemeraLudicGraph): PresenceGraphView => ({
    hostId: graph.hostId,
    nodeIds: [...graph.nodeIds],
    presenceNodes: graph.presenceNodes,
})

/** The member-side repairs for `memberId`. A host whose graph cannot be read counts as absent, so its orphans are report-only. */
const orphanRepairSteps = async (
    memberId: EphemeraMembershipHostId,
    memberGraph: EphemeraLudicGraph
): Promise<MutationKernelRepairPresenceBindingStep[]> => {
    const member = viewOf(memberGraph)
    const hosts = new Map<string, PresenceGraphView>()
    for (const binding of member.presenceNodes) {
        const hostId = binding.fromHostPresence?.host
        if (!hostId || hosts.has(hostId) || !isEphemeraMembershipHostId(hostId)) {
            continue
        }
        try {
            hosts.set(hostId, viewOf(await internalCache.Positions.getLudicGraph(hostId)))
        } catch (error) {
            // Unreadable reads as absent: the orphan stays report-only, and nothing is written for it.
        }
    }
    return orphanRepairsFor(member, (hostId) => hosts.get(hostId)).map(({ bindingId, fromHostPresence }) => {
        const binding = memberGraph.presenceNodes.find((node) => node.universalKey === bindingId)!
        return {
            kind: 'repairPresenceBinding',
            hostId: memberId,
            presenceId: bindingId as EphemeraPresenceNodeId,
            fromHostPresence: binding.fromHostPresence,
            cover: binding.cover,
        }
    })
}

/**
 * The `Presence Cover Drift Finding` consumer: rebuilds a whole's covers from its
 * members' `fromHostPresence` pointers, which govern (the cover is a stored index of them). Reads
 * the whole's graph and **every member's**, re-classifies with the sweep's own comparison
 * (`coverRebuildsFor`, so a redelivered finding whose drift is already healed commits nothing), and
 * rewrites each disagreeing cover through `repairPresenceBinding`: in place, same id, so no
 * pointer is orphaned. No new emitter.
 *
 * The same id is also judged as a **member**: each of its bindings whose pointer names a host that holds the
 * named binding but lacks this node (`orphanRepairsFor`) gets a `repairPresenceBinding` with pointer and cover
 * unchanged; `settleMembership` re-seats the node and `writeCoverIndex` re-adds the cover entry. It mints nothing.
 * An orphan whose host row or named binding is absent is not repaired (report-only in the sweep).
 *
 * **Not repaired, deliberately:** an unbound or duplicated member binding, an uncovered member, and a whole with no
 * `PRESENCE#Base`. Fixing those means minting a binding or a bucket, which the single write path reserves to the
 * move compiler and population. If any member's graph cannot be read the heal writes nothing, since
 * a rebuild over a partial read would drop that member's entry.
 *
 * **Never call this from a read path.** It is a write-carrying repair, run only from the finding
 * consumer or a manual invocation.
 */
export const healPresenceCover = async (
    wholeId: EphemeraMembershipHostId,
    deps: PopulateContainmentAtCacheDependencies
): Promise<void> => {
    const wholeGraph = await internalCache.Positions.getLudicGraph(wholeId)
    const whole = viewOf(wholeGraph)
    const views = new Map<string, PresenceGraphView>()
    for (const memberId of wholeMembersOf(whole)) {
        if (!isEphemeraMembershipHostId(memberId)) {
            continue
        }
        try {
            views.set(memberId, viewOf(await internalCache.Positions.getLudicGraph(memberId)))
        } catch (error) {
            console.error(`[mtw.ephemera.positions] healPresenceCover aborted for ${wholeId}: could not read ${memberId}`)
            return
        }
    }

    const coverSteps = coverRebuildsFor(whole, (memberId) => views.get(memberId)).map(({ bindingId, entries }): MutationKernelRepairPresenceBindingStep => {
        const binding = wholeGraph.presenceNodes.find((node) => node.universalKey === bindingId)!
        return {
            kind: 'repairPresenceBinding',
            hostId: wholeId,
            presenceId: bindingId as EphemeraPresenceNodeId,
            fromHostPresence: binding.fromHostPresence,
            cover: { members: entries.map((entry) => ({ host: entry.host as EphemeraPresenceCoverEntry['host'], presence: entry.presence as EphemeraPresenceNodeId })) },
        }
    })
    const orphanSteps = await orphanRepairSteps(wholeId, wholeGraph)
    const steps = [...coverSteps, ...orphanSteps]
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
        console.error(`[mtw.ephemera.positions] healPresenceCover failed for ${wholeId}: ${result.errorMessage}`)
    }
}
