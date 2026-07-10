import type { EphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ManipulationVerbClass } from '../../baseClasses'
import type { ObjectManipulationCatalogEntry, ObjectManipulationCatalogScope } from './catalogMerge'
import { existencePresenceGuard } from './existencePresenceGuard'
import { proposeMembershipTuples } from './proposeMembershipTuples'
import { objectManipulationErrorMessages } from './resolveObjectSpan'
import {
    selectIdentityPlanTuple,
    type SelectIdentityPlanTupleResult,
} from './selectIdentityPlanTuple'
import type { SpanCandidatePool, SpanResolutionConsultAlternative } from './spanResolution'
import { locusToCatalogScope } from './unaryCollapse'
import type { ValidateMembershipPlanContext } from './validatePlanDryRun'

export type SelectMembershipFromPoolResult =
    | {
        type: 'resolved'
        objectId: EphemeraObjectId
        operationKind: 'takeHold' | 'drop'
        catalogScope: ObjectManipulationCatalogScope
    }
    | {
        type: 'defer'
        objectId: EphemeraObjectId
        catalogScope: ObjectManipulationCatalogScope
    }
    | {
        type: 'consult'
        alternatives: readonly SpanResolutionConsultAlternative[]
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
    dryRunContext?: ValidateMembershipPlanContext
    commandSpan?: string
}

/**
 * Membership FT-2.2 glue: propose-N -> FT-5 selector -> existence/presence guard.
 * Thin-margin consult preserves alternatives for Consult egress; grey-band -> Abstain (FT-3.2).
 */
export function selectMembershipFromPool(
    input: SelectMembershipFromPoolInput
): SelectMembershipFromPoolResult {
    const { spanPools, verbClass, catalog, dryRunContext, commandSpan } = input

    if (spanPools.length === 0) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.noMatch,
        }
    }

    if (spanPools.length > 1) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.ambiguousMatch,
        }
    }

    const pool = spanPools[0]!
    const tuples = proposeMembershipTuples({ pool, verbClass })
    const selection = selectIdentityPlanTuple({
        candidates: tuples,
        dryRunContext,
        commandSpan: commandSpan ?? pool.span,
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
        }
    }

    return {
        type: 'resolved',
        objectId: candidate.identity.objectId,
        operationKind: candidate.plan.operationKind,
        catalogScope,
    }
}
