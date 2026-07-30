import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ActionsPublishedPayload, LookCommandRequestedPublishedPayload } from '../../../actions/publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { sendMessageSlotReported } from '../../../messageOrchestration/subscribedEvents'
import {
    buildMembershipArriveSuffix,
    buildMembershipLeaveSuffix,
} from '../../../perception/publishMembershipPresentation'
import { isDescribeStep, isNarrateStep, type KernelStep } from './kernelStep'
import type { MutationKernelCaptures } from './types'

export type PresentStepSequenceDeps = {
    streamEvent: StreamEventFunction<ActionsPublishedPayload>
    messageBus: MessageBus
}

/**
 * The presentation kernel's describe branch (shipped iteration 9/Phase 3 as "the perception kernel";
 * renamed under PB-L --- see `AGENT.presentationKernel.planning.md` --- because every `*Presentation*`
 * identifier elsewhere in this codebase already means "publishing into the transcript," and this
 * function does exactly that): NOT a second `commitStepSequence`. It owns no
 * `transactWrite`, no footprint locking, no retry --- those exist only to make a *write* atomic
 * across hosts, and a `describe` step never mutates anything. This is a straight publish loop over
 * a shared, already-grounded `KernelStep[]` list, filtered down to the `describe` steps it owns
 * (mirrors the mutation kernel's own `isKernelMutationStep` filter --- see `kernelStep.ts`). The
 * narration branch that joins it as the presentation kernel's other half is built below (Phase 2 of
 * the same plan).
 *
 * Delivery reuses the existing `Look Command Requested` pipeline verbatim (PK-4, resolved
 * 2026-07-24: reuse, not a new mechanism) --- the same event `routeTrustedUiAction.ts` / bare
 * `look`/`l` parse already publish, already consumed unchanged by
 * `renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`, which declares its own
 * messageOrchestration bundle per event (Phase 7) --- no bundle correlation is threaded through
 * here, since nothing today produces more than one describe step per call (see that phase's
 * planning doc note on why this was simplified back out of a declare-upstream shape). Room/Feature/
 * Knowledge referents get real end-to-end delivery this way; Object referents get a **stub**
 * delivery (PK-6): `ensureObjectShortNameCacheRecord.ts` publishes `shortName` only, since
 * `StandardObjectData` has no `render` field yet --- real `<Render>`/`<Example>` authoring support
 * is separate, deferred work. Character referents still have no render content model at all and
 * throw a named, honest error rather than silently no-op or attempt partial rendering.
 */
export const presentStepSequence = async (
    steps: readonly KernelStep[],
    characterId: EphemeraCharacterId,
    deps: PresentStepSequenceDeps,
    captures: MutationKernelCaptures = new Map()
): Promise<void> => {
    const describeSteps = steps.filter(isDescribeStep)

    for (const step of describeSteps) {
        const { referentId, referentKind } = step

        if (referentKind === 'character') {
            throw new Error(
                `presentStepSequence: '${referentKind}' describe steps are not yet supported --- no render content model exists for Character referents yet (see AGENT.perceptionKernel.planning.md Phase 3 context)`
            )
        }

        if (!(
            isEphemeraRoomId(referentId)
            || isEphemeraFeatureId(referentId)
            || isEphemeraKnowledgeId(referentId)
            || isEphemeraObjectId(referentId)
        )) {
            throw new Error(
                `presentStepSequence: describe step referentKind '${referentKind}' does not match a Room/Feature/Knowledge/Object referentId (${referentId})`
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

    const narrateSteps = steps.filter(isNarrateStep)

    for (const step of narrateSteps) {
        const audience = captures.get(step.captureId) ?? []
        const name = step.characterName || 'Someone'
        const suffix = step.direction === 'leave'
            ? buildMembershipLeaveSuffix(step.copyKind, step.exitName)
            : buildMembershipArriveSuffix(step.copyKind)

        sendMessageSlotReported(deps.messageBus, step.bundleId, {
            bundleId: step.bundleId,
            slotId: step.slotId,
            message: {
                type: 'PublishMessage',
                targets: [step.roomId, ...audience],
                displayProtocol: 'WorldMessage',
                message: [`${name}${suffix}`],
                createdTime: 0,
            },
        })
    }
}
