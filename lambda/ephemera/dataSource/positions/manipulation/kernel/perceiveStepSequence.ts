import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ActionsPublishedPayload, LookCommandRequestedPublishedPayload } from '../../../actions/publishedEvents'
import { isDescribeStep, type KernelStep } from './kernelStep'

export type PerceiveStepSequenceDeps = {
    streamEvent: StreamEventFunction<ActionsPublishedPayload>
}

/**
 * Iteration 9/Phase 3's perception kernel: NOT a second `commitStepSequence`. It owns no
 * `transactWrite`, no footprint locking, no retry --- those exist only to make a *write* atomic
 * across hosts, and a `describe` step never mutates anything. This is a straight publish loop over
 * a shared, already-grounded `KernelStep[]` list, filtered down to the `describe` steps it owns
 * (mirrors the positionGraph kernel's own `isKernelMutationStep` filter --- see `kernelStep.ts`).
 *
 * Delivery reuses the existing `Look Command Requested` pipeline verbatim (PK-4, resolved
 * 2026-07-24: reuse, not a new mechanism) --- the same event `routeTrustedUiAction.ts` / bare
 * `look`/`l` parse already publish, already consumed unchanged by
 * `renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`. Room/Feature/Knowledge
 * referents get real end-to-end delivery this way; Object referents get a **stub** delivery (PK-6):
 * `ensureObjectShortNameCacheRecord.ts` publishes `shortName` only, since `StandardObjectData` has
 * no `render` field yet --- real `<Render>`/`<Example>` authoring support is separate, deferred work.
 * Character referents still have no render content model at all and throw a named, honest error
 * rather than silently no-op or attempt partial rendering.
 */
export const perceiveStepSequence = async (
    steps: readonly KernelStep[],
    characterId: EphemeraCharacterId,
    deps: PerceiveStepSequenceDeps
): Promise<void> => {
    const describeSteps = steps.filter(isDescribeStep)

    for (const step of describeSteps) {
        const { referentId, referentKind } = step

        if (referentKind === 'character') {
            throw new Error(
                `perceiveStepSequence: '${referentKind}' describe steps are not yet supported --- no render content model exists for Character referents yet (see AGENT.perceptionKernel.planning.md Phase 3 context)`
            )
        }

        if (!(
            isEphemeraRoomId(referentId)
            || isEphemeraFeatureId(referentId)
            || isEphemeraKnowledgeId(referentId)
            || isEphemeraObjectId(referentId)
        )) {
            throw new Error(
                `perceiveStepSequence: describe step referentKind '${referentKind}' does not match a Room/Feature/Knowledge/Object referentId (${referentId})`
            )
        }

        const payload: LookCommandRequestedPublishedPayload = {
            type: 'Look Command Requested',
            characterId,
            componentId: referentId,
            confidence: 1,
        }
        await deps.streamEvent({
            streamKey: characterId,
            header: { type: 'Look Command Requested' },
            update: payload,
        })
    }
}
