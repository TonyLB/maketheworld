import { v4 as uuidv4 } from 'uuid'
import type { EphemeraPresenceNodeId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraPresenceCoverRemainder } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraPresenceCoverEntry } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'
import { PresenceKey } from '@tonylb/mtw-utilities/ts/types'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { PositionKernelSplitOp } from '../kernel/compile/positionKernelOp'

export type ResolvePresenceSplitArgs = {
    whole: EphemeraMembershipHostId
    /** The binding of the whole to split. */
    presence: EphemeraPresenceNodeId
    /**
     * One list of member hosts per NEW binding. The members named leave the original for that binding;
     * every member not named stays on the original, along with its `Remainder`.
     */
    moveOut: readonly (readonly EphemeraMembershipHostId[])[]
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
}

export type ResolvedPresenceSplit =
    | { ok: true; op: PositionKernelSplitOp }
    | { ok: false; errorCode: 'bindingMissing' | 'memberNotCovered' | 'memberInTwoGroups' | 'emptyGroup' | 'childBindingMissing' | 'childBindingMoved' }

/**
 * The planner's half of a split: reads the whole's graph and each child that will change parent,
 * mints the new bindings' ids and builds `splitInto`. The original binding keeps its id, its
 * remaining entries and its `Remainder` (so a split never moves an unlisted member). A child that
 * no longer holds the binding the cover names, or that no longer sits under the split binding, is a
 * refusal here; the kernel re-verifies each inside the lock, so a read gone stale is `stale`, not a
 * wrong write.
 */
export const resolvePresenceSplit = async (args: ResolvePresenceSplitArgs): Promise<ResolvedPresenceSplit> => {
    const node = (await args.getGraph(args.whole)).presenceNodes.find(({ universalKey }) => universalKey === args.presence)
    if (!node) {
        return { ok: false, errorCode: 'bindingMissing' }
    }
    const entries = node.cover.members.filter((member): member is EphemeraPresenceCoverEntry => !isEphemeraPresenceCoverRemainder(member))
    const named = args.moveOut.flat()
    if (args.moveOut.some((group) => group.length === 0)) {
        return { ok: false, errorCode: 'emptyGroup' }
    }
    if (new Set(named).size !== named.length) {
        return { ok: false, errorCode: 'memberInTwoGroups' }
    }
    if (named.some((host) => !entries.some((entry) => entry.host === host))) {
        return { ok: false, errorCode: 'memberNotCovered' }
    }

    for (const host of named) {
        const entry = entries.find((candidate) => candidate.host === host)!
        const binding = (await args.getGraph(host)).presenceNodes.find(({ universalKey }) => universalKey === entry.presence)
        if (!binding) {
            return { ok: false, errorCode: 'childBindingMissing' }
        }
        if (binding.fromHostPresence?.host !== args.whole || binding.fromHostPresence.presence !== args.presence) {
            return { ok: false, errorCode: 'childBindingMoved' }
        }
    }

    return {
        ok: true,
        op: {
            kind: 'split',
            whole: args.whole,
            presence: args.presence,
            splitInto: [
                {
                    presence: args.presence,
                    cover: { members: node.cover.members.filter((member) => isEphemeraPresenceCoverRemainder(member) || !named.includes(member.host as EphemeraMembershipHostId)) },
                },
                ...args.moveOut.map((group) => ({
                    presence: PresenceKey(uuidv4()) as EphemeraPresenceNodeId,
                    cover: { members: entries.filter((entry) => group.includes(entry.host as EphemeraMembershipHostId)) },
                })),
            ],
        },
    }
}
