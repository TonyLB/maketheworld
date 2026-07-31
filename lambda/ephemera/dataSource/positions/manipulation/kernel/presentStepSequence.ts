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
import { isDescribeStep, isNarrateStep, type KernelStep, type NarrationSpecification } from './kernelStep'
import type { MutationKernelCaptures } from './types'

/**
 * The presentation kernel's copy-generator: the *only* consumer of a narration step's `narration`
 * field, and the one place a `NarrationSpecification` is dispatched on. Kept deliberately thin ---
 * the expectation was that a second family would arrive as a `case` delegating to a per-family
 * module rather than a block of copy logic inlined here. Phase 4's `objectMove` case is inline
 * because it is five lines; the per-family module is what to reach for when a family's copy logic
 * stops fitting in a glance, not a rule to apply pre-emptively. See `kernelStep.ts`'s
 * `NarrationSpecification` doc for the conditions under which this dispatcher should give way to
 * polymorphism instead.
 *
 * Takes only the spec today. A family needing to reason over the commit's captured rosters (rather
 * than just be delivered to them) is a signature change --- add `captures` as a second argument ---
 * not a reason to move copy-building onto the step itself.
 */
const buildNarrationCopy = (narration: NarrationSpecification): string => {
    switch (narration.kind) {
        case 'membershipMove': {
            const name = narration.characterName || 'Someone'
            const suffix = narration.direction === 'leave'
                ? buildMembershipLeaveSuffix(narration.copyKind, narration.exitName)
                : buildMembershipArriveSuffix(narration.copyKind)
            return `${name}${suffix}`
        }
        case 'objectMove': {
            const name = narration.characterName || 'Someone'
            // Preserved verbatim from the retired `publishObjectManipulationPresentation.ts`.
            const carried = narration.carriedCount > 1 ? ' and everything on it' : ''
            const verbPhrase = narration.verb === 'takeHold'
                ? 'picks up'
                : narration.verb === 'drop'
                ? 'drops'
                : 'gives'
            return `${name} ${verbPhrase} ${narration.objectShortName}${carried}`
        }
    }
}

export type PresentStepSequenceDeps = {
    streamEvent: StreamEventFunction<ActionsPublishedPayload>
    messageBus: MessageBus
}

/**
 * The presentation kernel's describe branch (shipped first as "the perception kernel"; renamed
 * because every `*Presentation*` identifier elsewhere in this codebase already means "publishing
 * into the transcript," and this function does exactly that, while `perception` is both the broad
 * experience category and a data source's name --- see `dataSource/positions/AGENT.concepts.md`,
 * "Two kernels"): NOT a second `commitStepSequence`. It owns no
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
        /**
         * Hard error, never a fallback. `captureId`s are minted only by
         * `compile/compilePositionKernelOp.ts` (PB-I), paired with a capture step in the same
         * compiled plan, so a miss here means the plan reaching the presentation kernel is not the
         * plan the compiler emitted --- an internal inconsistency. The tempting recovery (fall back
         * to a live `ROOM#` target) is precisely the terminal binding this step type exists to
         * avoid, and would convert a structural bug into a silently-wrong audience; an empty
         * audience would hide it just as thoroughly, only quieter.
         */
        if (!captures.has(step.captureId)) {
            throw new Error(
                `presentStepSequence: narrate step references captureId '${step.captureId}', which the commit produced no capture for --- narration audiences are positionally bound and have no live-roster fallback (see kernelStep.ts's PresentationKernelNarrateStep)`
            )
        }
        const audience = captures.get(step.captureId) ?? []

        sendMessageSlotReported(deps.messageBus, step.bundleId, {
            bundleId: step.bundleId,
            slotId: step.slotId,
            message: {
                type: 'PublishMessage',
                targets: [...audience],
                displayProtocol: 'WorldMessage',
                message: [buildNarrationCopy(step.narration)],
                createdTime: 0,
            },
        })
    }
}
