import type { EphemeraCharacterId, EphemeraObjectId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry, ObjectManipulationCatalogScope } from './catalogMerge'
import { existencePresenceGuard } from './existencePresenceGuard'
import type { GroundedMembershipCandidate } from './groundMembershipCandidates'
import { proposeMembershipTuples } from './proposeMembershipTuples'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import type { SandboxState } from './sandboxState'
import {
    selectIdentityPlanTuple,
    type SelectIdentityPlanTupleResult,
} from './selectPlanCandidate'
import type { ConsultAlternative, SpanCandidatePool } from './spanResolution'
import { locusToCatalogScope } from './unaryCollapse'

export type SelectMembershipFromPoolResult =
    | {
        type: 'resolved'
        objectId: EphemeraObjectId
        /** The moved object (one entry); anything it hosts travels with its shard. */
        objectIds: EphemeraObjectId[]
        operationKind: 'takeHold' | 'drop'
        catalogScope: ObjectManipulationCatalogScope
        /** The selected (identity, plan) tuple with its grounded attempt. */
        candidate: GroundedMembershipCandidate
    }
    | {
        type: 'defer'
        objectId: EphemeraObjectId
        catalogScope: ObjectManipulationCatalogScope
        /** The selected (identity, plan) tuple with its grounded attempt. */
        candidate: GroundedMembershipCandidate
    }
    | {
        type: 'consult'
        alternatives: readonly ConsultAlternative[]
    }
    | {
        type: 'abstain'
        reason: string
    }
    | {
        type: 'error'
        errorMessage: string
    }

export type SelectMembershipFromPoolInput = {
    spanPools: readonly SpanCandidatePool[]
    verbClass: ManipulationVerbClass
    catalog: readonly ObjectManipulationCatalogEntry[]
    /** Live KR state (room + acting character's own inventory), for the sandbox-mediated dry run. */
    sandboxState?: SandboxState
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
    commandSpan?: string
    /** The player's words, for each candidate's attempt. */
    words?: string
}

/**
 * Membership FT-2.2 glue: propose-N -> FT-5 selector -> existence/presence guard.
 * Thin-margin consult preserves alternatives for Consult egress; grey-band -> Abstain (FT-3.2).
 */
export function selectMembershipFromPool(
    input: SelectMembershipFromPoolInput
): SelectMembershipFromPoolResult {
    const { spanPools, verbClass, catalog, sandboxState, roomId, actorCharacterId, commandSpan, words } = input

    if (spanPools.length === 0) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        }
    }

    const pool = spanPools[0]!
    const tuples = proposeMembershipTuples({ pool, verbClass })
    const selection = selectIdentityPlanTuple({
        candidates: tuples,
        sandboxState,
        roomId,
        actorCharacterId,
        commandSpan: commandSpan ?? pool.span,
        words,
        catalog,
    })

    return mapSelection(selection, catalog)
}

function mapSelection(
    selection: SelectIdentityPlanTupleResult,
    catalog: readonly ObjectManipulationCatalogEntry[]
): SelectMembershipFromPoolResult {
    if (selection.verdict === 'error') {
        return {
            type: 'error',
            errorMessage: selection.reason,
        }
    }

    if (selection.verdict === 'abstain') {
        return {
            type: 'abstain',
            reason: selection.reason,
        }
    }

    if (selection.verdict === 'consult') {
        return {
            type: 'consult',
            alternatives: selection.alternatives,
        }
    }

    const { candidate } = selection
    const guard = existencePresenceGuard(candidate, catalog)
    if (guard.type === 'error') {
        return {
            type: 'error',
            errorMessage: guard.reason,
        }
    }

    const catalogScope = locusToCatalogScope(candidate.identity.locus)

    if (selection.verdict === 'defer') {
        return {
            type: 'defer',
            objectId: candidate.identity.objectId,
            catalogScope,
            candidate,
        }
    }

    return {
        type: 'resolved',
        objectId: candidate.identity.objectId,
        objectIds: selection.dryRun.objectIds ?? [candidate.identity.objectId],
        operationKind: candidate.plan.operationKind,
        catalogScope,
        candidate,
    }
}
