import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isEphemeraObjectId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { invokeBedrockObjectManipulationEnrich } from '../../../../../generateExample/invokeBedrockObjectManipulationEnrich'
import type { ObjectManipulationCatalogEntry } from '../catalogMerge'
import { identityPlanCandidateFromSpan, type IdentityPlanCandidate } from '../identityPlanCandidate'
import { objectManipulationErrorMessages } from '../resolveObjectSpan'
import {
    membershipConsultAlternative,
    sandboxMembershipDryRun,
    selectPlanTuple,
    type SelectPlanTupleInput,
    type SelectPlanTupleResult,
} from '../selectIdentityPlanTuple'
import type { SandboxState } from '../sandboxState'
import type { ObjectSpanCandidate } from '../spanResolution'
import { buildIdentityOnlyFallbackPrompt } from './buildIdentityOnlyFallbackPrompt'
import { interpretIdentityOnlyFallbackBody } from './interpretIdentityOnlyFallback'

/**
 * Identity-only fallback (BD-19 (1)): Plan already succeeded deterministically ---
 * this LLM proposes N ranked identity candidates against that fixed plan. Reuses
 * `IdentityPlanCandidate` verbatim (BD-19 (2): no plan-side cross-product exists
 * here, so no combined-confidence field is needed --- `confidence` is just the
 * LLM's own reported identity score, same field identity always had).
 * Membership domain only --- relational (subject/target) is a deliberate,
 * named follow-on, not yet built.
 */
export type IdentityOnlyFallbackInput = {
    command: string
    rawObjectSpan: string
    catalog: readonly ObjectManipulationCatalogEntry[]
    operationKind: 'takeHold' | 'drop'
}

export type IdentityOnlyFallbackDeps = {
    invokeBedrockObjectManipulationIdentityOnlyFallbackImpl?: typeof invokeBedrockObjectManipulationEnrich
}

export type IdentityOnlyFallbackInvokeResult =
    | { type: 'success'; candidates: readonly IdentityPlanCandidate[] }
    | { type: 'error'; errorMessage: string }

export async function invokeIdentityOnlyFallback(
    input: IdentityOnlyFallbackInput,
    deps: IdentityOnlyFallbackDeps = {}
): Promise<IdentityOnlyFallbackInvokeResult> {
    const invoke = deps.invokeBedrockObjectManipulationIdentityOnlyFallbackImpl
        ?? invokeBedrockObjectManipulationEnrich
    const promptParts = buildIdentityOnlyFallbackPrompt(input.command, input)
    const invokeResult = await invoke(promptParts)
    if (!invokeResult.success) {
        return {
            type: 'error',
            errorMessage: objectManipulationErrorMessages.identityOnlyFallbackInvokeFailed,
        }
    }

    const parsed = interpretIdentityOnlyFallbackBody(invokeResult.body)
    if (!parsed.success) {
        return { type: 'error', errorMessage: parsed.errorMessage }
    }

    const catalogById = new Map(input.catalog.map((entry) => [entry.objectId, entry]))
    const candidates: IdentityPlanCandidate[] = []
    for (const { objectId, confidence } of parsed.candidates) {
        if (!isEphemeraObjectId(objectId)) {
            continue
        }
        const entry = catalogById.get(objectId)
        if (!entry) {
            continue
        }
        const spanCandidate: ObjectSpanCandidate = {
            id: entry.objectId,
            label: entry.normalizedShortName,
            jointRelevance: confidence,
            sourceTags: ['llm'],
            locus: entry.catalogScope === 'room' ? { kind: 'room' } : { kind: 'heldByActor' },
        }
        candidates.push(identityPlanCandidateFromSpan(spanCandidate, input.operationKind))
    }

    return { type: 'success', candidates }
}

export async function proposeIdentityOnlyFallbackTuples(
    input: IdentityOnlyFallbackInput,
    deps: IdentityOnlyFallbackDeps = {}
): Promise<readonly IdentityPlanCandidate[]> {
    const result = await invokeIdentityOnlyFallback(input, deps)
    return result.type === 'success' ? result.candidates : []
}

export type IdentityOnlyFallbackDryRunContext = {
    sandboxState?: SandboxState
    roomId?: EphemeraRoomId
    actorCharacterId?: EphemeraCharacterId
}

export async function selectIdentityOnlyFallbackTuple(
    input: IdentityOnlyFallbackInput,
    dryRunContext: IdentityOnlyFallbackDryRunContext = {},
    deps: IdentityOnlyFallbackDeps = {}
): Promise<SelectPlanTupleResult<IdentityPlanCandidate>> {
    const { sandboxState = new Map(), roomId, actorCharacterId } = dryRunContext
    const candidates = await proposeIdentityOnlyFallbackTuples(input, deps)
    const selectInput: SelectPlanTupleInput<IdentityPlanCandidate> = {
        candidates,
        getConfidence: (candidate) => candidate.confidence,
        dryRun: (candidate) => sandboxMembershipDryRun(candidate, sandboxState, roomId, actorCharacterId),
        toConsultAlternative: (candidate) => membershipConsultAlternative(candidate, input.rawObjectSpan),
    }
    return selectPlanTuple(selectInput)
}
