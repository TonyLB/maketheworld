import type { EphemeraCharacterId, EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraLudicTerminalPrimitive } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'
import type { EphemeraMembershipHostId } from '@tonylb/mtw-interfaces/ts/ephemeraPositionAdjacency'

import type { EphemeraLudicGraph } from '../../ludicGraph'
import type { MutationKernelStep } from '../kernel/kernelStep'
import { buildCrossingDissolveLegs } from '../../../actions/enrich/objectManipulation/synthesize/buildCrossingLegs'
import { fetchRelationalReachability, findRelationalChainsTouching } from '../relational/findRelationalChainsForRemoval'

export type RepairAdministrativeChainDissolveResult = {
    dissolveSteps: readonly MutationKernelStep[]
    hostByReferencedId: ReadonlyMap<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>
}

/**
 * The administrative repair policy (3d, 2026-09-08): may sever anything. Administrative
 * repositions (navigate, room place/remove, spawn, destroy/edit, drift repair) have no acting
 * character and no legality question to ask, so this runs chain-aware and unconditional ---
 * following crossing ports across hosts and dissolving every relational chain touching the
 * departing entity, with no "carry vs. defer" ambiguity the way a real move has, since nothing
 * needs to decide where the other participant ends up. Sibling of `repairMechanicalDissolve`,
 * which is the opposite, authority-gated policy for a player action.
 *
 * Extracted verbatim from `executeMembershipTransfer`'s pre-3d body --- no behavior change.
 * `boundaryEdgeOutcomes` stays Object-only, so a Character entity produces no dissolve steps here
 * (a character can never carry a relational edge).
 */
export const repairAdministrativeChainDissolve = async (
    entityId: EphemeraObjectId | EphemeraCharacterId,
    getMembershipContainers: (id: EphemeraObjectId | EphemeraCharacterId) => Promise<EphemeraMembershipHostId[]>,
    getGraph: (hostId: EphemeraMembershipHostId) => Promise<EphemeraLudicGraph>
): Promise<RepairAdministrativeChainDissolveResult> => {
    const hostByReferencedId = new Map<EphemeraLudicTerminalPrimitive, EphemeraMembershipHostId>()
    const dissolveSteps: MutationKernelStep[] = []

    if (isEphemeraObjectId(entityId)) {
        const entitySet = new Set([entityId])
        const graphs = await fetchRelationalReachability(entitySet, getMembershipContainers, getGraph)
        const chains = findRelationalChainsTouching(entitySet, graphs)
        chains.forEach((chain) => {
            buildCrossingDissolveLegs(chain).forEach((step) => {
                dissolveSteps.push(step)
                if (step.kind === 'dissolveRelation') {
                    if (isEphemeraLudicTerminalPrimitive(step.subjectId)) {
                        hostByReferencedId.set(step.subjectId, step.hostId)
                    }
                    if (isEphemeraLudicTerminalPrimitive(step.targetId)) {
                        hostByReferencedId.set(step.targetId, step.hostId)
                    }
                }
            })
        })
    }

    return { dissolveSteps, hostByReferencedId }
}
