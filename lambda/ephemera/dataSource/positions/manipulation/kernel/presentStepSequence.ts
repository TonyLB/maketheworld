import type { StreamEventFunction } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import {
    isEphemeraCharacterId,
    isEphemeraFeatureId,
    isEphemeraKnowledgeId,
    isEphemeraObjectId,
    isEphemeraRoomId,
} from '@tonylb/mtw-interfaces/ts/baseClasses'

import type { ActionsPublishedPayload, LookCommandRequestedPublishedPayload } from '../../../actions/publishedEvents'
import type { MessageBus } from '../../../../messageBus/baseClasses'
import { v4 as uuidv4 } from 'uuid'
import internalCache from '../../../../internalCache'
import getCurrentTimestamp from '../../../../internalUtils/dateUtil'
import { registerIngressSlot } from '../../../messageOrchestration'
import type { IngressListenerSpec } from '../../../messageOrchestration/contentIngress'
import { kickPassiveRenderRequestedForCharacterInRoom } from '../../../perception/kickRoomHeaderBroadcast'
import { roomHeaderChannelWmlForRoomId } from '../../../perception/roomRenderWmlFromCacheRecord'
import {
    buildMembershipArriveSuffix,
    buildMembershipLeaveSuffix,
} from '../../../perception/publishMembershipPresentation'
import { isDescribeStep, isNarrateStep, type KernelStep, type NarrationSpecification } from './kernelStep'
import type { ExecutorDescribeStep } from '../../../actions/enrich/objectManipulation/synthesize/executorTypes'
import { fillNarrationTemplate } from './narrationTemplate'
import type { MutationKernelCaptures } from './types'

/**
 * The presentation kernel's copy-generator: the *only* consumer of a narration step's `narration`
 * field, and the one place a `NarrationSpecification` is dispatched on. Kept deliberately thin:
 * the membership family's copy is inline (it is a suffix lookup), and template copy (object moves
 * today, authored narration later) is filled by `narrationTemplate.ts`, which owns the parts and
 * the fill. See `kernelStep.ts`'s `NarrationSpecification` doc for the conditions under which this
 * dispatcher should give way to polymorphism instead.
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
        case 'template':
            return fillNarrationTemplate(narration)
    }
}

const newMessageId = (): string => `MESSAGE#${uuidv4()}`

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
 * Delivery reuses the existing `Look Command Requested` pipeline (PK-4, resolved
 * 2026-07-24: reuse, not a new mechanism) --- the same event `routeTrustedUiAction.ts` / bare
 * `look`/`l` parse already publish, consumed by
 * `renderOrchestration/handleLookCommandRequestedForRenderOrchestration.ts`, which registers a
 * direct ingress listener per event. The step's stamped `createdTime` and `messageId` ride on the
 * payload, so the look lands at its place in the plan's transcript order.
 * Room/Feature/Knowledge/Object/Character referents all get real end-to-end delivery this way.
 * A `describe` step carrying a `header` binding (a move's arrival header) instead registers its
 * own header-format listener and kicks the passive render, since a header is the mover's alone and
 * is not a look.
 *
 * **Presentation order.** The plan's `describe` and `narrate` steps, in array order, are its
 * transcript order: entry *i* is stamped `beatAnchorTime + i` (1 ms apart, so every step in one
 * plan has a distinct time) and given its own fresh `MessageId`. Returns the first index the plan
 * did not use, for a caller with further lines in the same beat.
 *
 * **Object's PK-6 stub is retired** (`cf5472cef`, "Removed stub object perception"). This comment
 * used to say Object got `shortName` only, via `renderCache/ensureObjectShortNameCacheRecord.ts`,
 * "since `StandardObjectData` has no `render` field yet." Both halves are now false:
 * `StandardObjectData.render` exists (`mtw-wml/ts/standardize/components/dataTypes/object.ts`),
 * the stub file is deleted in favour of `renderCache/ensureAuthoredCatalog.ts`, and
 * `perception/objectRenderWmlFromCacheRecord.ts` passes `renderedContent` straight through to the
 * `<Render>` facet exactly as Feature/Knowledge do. Object still additionally carries a
 * `<ShortName>` --- `<Object>`'s content model structurally requires one --- which is a content-model
 * difference, not a delivery one. The only remaining `shortName`-only Object render is
 * `perception/orchestrate.ts`'s `placeholderObjectFullWml`, and that is the in-flight
 * `'Generating'`/`'Error'` status placeholder, not the description path.
 */
export const presentStepSequence = async (
    steps: readonly KernelStep[],
    characterId: EphemeraCharacterId,
    deps: PresentStepSequenceDeps,
    captures: MutationKernelCaptures = new Map(),
    beatAnchorTime: number = getCurrentTimestamp()
): Promise<number> => {
    const presentationSteps = steps.filter((step) => isDescribeStep(step) || isNarrateStep(step))

    for (const [index, step] of presentationSteps.entries()) {
        const createdTime = beatAnchorTime + index
        const messageId = newMessageId()

        if (isDescribeStep(step)) {
            await presentDescribeStep(step, characterId, deps, { createdTime, messageId })
            continue
        }
        if (!isNarrateStep(step)) {
            continue
        }

        /**
         * Hard error, never a fallback. `captureId`s are minted only by
         * `compile/compilePositionKernelOp.ts`, paired with a capture step in the same
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

        deps.messageBus.publish({
            type: 'PublishMessage',
            targets: [...audience],
            displayProtocol: 'WorldMessage',
            message: [buildNarrationCopy(step.narration)],
            messageId,
            createdTime,
        })
    }

    return presentationSteps.length
}

const presentDescribeStep = async (
    step: ExecutorDescribeStep,
    characterId: EphemeraCharacterId,
    deps: PresentStepSequenceDeps,
    stamp: { createdTime: number; messageId: string }
): Promise<void> => {
    const { referentId, referentKind } = step

    if (!(
        isEphemeraRoomId(referentId)
        || isEphemeraFeatureId(referentId)
        || isEphemeraKnowledgeId(referentId)
        || isEphemeraObjectId(referentId)
        || isEphemeraCharacterId(referentId)
    )) {
        throw new Error(
            `presentStepSequence: describe step referentKind '${referentKind}' does not match a Room/Feature/Knowledge/Object/Character referentId (${referentId})`
        )
    }

    if (step.header) {
        if (!isEphemeraRoomId(referentId)) {
            throw new Error(`presentStepSequence: a header describe step needs a Room referent (${referentId})`)
        }
        const { perspectiveKey, assets } = step.header
        if (perspectiveKey === null) {
            // The character's assets match no stack for the room: no render can be keyed, so the
            // header is the static one from the cache record, still at its stamped place.
            const cacheRecords = await internalCache.RenderCache.get(referentId)
            deps.messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'PerceptionMessage',
                wmlContent: roomHeaderChannelWmlForRoomId(referentId, cacheRecords),
                metaData: { componentUUID: referentId, displayMode: 'header', roomChannel: 'render' },
                messageId: stamp.messageId,
                createdTime: stamp.createdTime,
            })
            return
        }
        const spec: IngressListenerSpec = {
            componentId: referentId,
            perspectiveKey,
            targets: [characterId],
            contentStream: 'render',
            format: 'header',
        }
        await registerIngressSlot(deps.messageBus, { ...stamp }, spec, async () => {
            await kickPassiveRenderRequestedForCharacterInRoom({
                roomId: referentId,
                characterId,
                assets,
                messageBus: deps.messageBus,
            })
        })
        return
    }

    const payload: LookCommandRequestedPublishedPayload = {
        type: 'Look Command Requested',
        characterId,
        componentId: referentId,
        confidence: 1,
        createdTime: stamp.createdTime,
        messageId: stamp.messageId,
    }
    await deps.streamEvent({
        streamKey: characterId,
        header: { type: 'Look Command Requested' },
        update: payload,
    })
}
