/**
 * mtw.ephemera.actions DataSource.
 *
 * **`stableKey`** on **`Acme Order`** stream payloads: prefetch Coyote-wide occupancy,
 * **`parseCommand`** (Acme order enrich uses the same snapshot), then
 * **`finalizeStableKeysDeterministic`** before **`streamEvent`** ---
 * see **`Where enforcement runs`** in [`AGENT.md`](./AGENT.md) (**Acme catalog lines and `stableKey`**).
 */
import { isEphemeraCharacterId, type EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { RenderTree } from '@tonylb/mtw-base/ts/renderTree'

import EphemeraDataSource from '../abstract'
import type { AcmeOrderPublishedOrder, ActionsPublishedPayload } from './publishedEvents'
import type { ActionsSubscribedContent } from './subscribedEvents'
import {
    isActionsActionAssessedEnvelope,
    isActionsParseRequestedEnvelope,
    isActionsSubscribedEnvelope,
} from './subscribedEvents'
import { isActionAssessedCommand, isParseRequestedCommand, type ActionAssessedCommand, type ParseRequestedCommand } from '../localApiEvents'
import messageBus from '../../messageBus'
import internalCache from '../../internalCache'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import type { RoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import {
    attachEmbeddingsToCatalogEntries,
    catalogObjectIdsUnion,
} from './attachEmbeddingsToCatalogEntries'
import { getHeldInventoryCatalogForCharacter } from './heldInventoryCatalogForCharacter'
import { getRoomObjectCatalogForCharacter, roomObjectLabelsFromCatalog } from './roomObjectCatalogForCharacter'
import { resolveHomeTargetForCharacter } from './resolveHomeTargetForCharacter'
import {
    type ParseCommandAcmeOrderLine,
    type ParseCommandConsultAlternative,
    type ParseCommandResult,
    isParseCommandAbstainResult,
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandCharacterSpokeResult,
    isParseCommandConsultResult,
    isParseCommandCoyoteAffinitiesTestResult,
    isParseCommandCoyoteEngineTestResult,
    isParseCommandErrorResult,
    isParseCommandHelpResult,
    isParseCommandHomeResult,
    isParseCommandLookRoomResult,
    isParseCommandLookComponentResult,
    isParseCommandMultipleCommandsResult,
    isParseCommandNavigationResult,
    isParseCommandObjectManipulationResult,
    isParseCommandEstablishRelationResult,
    isParseCommandPredictHypothesisResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'
import { MULTIPLE_COMMANDS_PLAYER_MESSAGE } from './multipleCommandsPlayerMessage'
import { parseCommand } from './parseCommand'
import { navigationIntentErrorMessages, objectManipulationErrorMessages } from './parseCommand'
import { collectCoyoteOccupiedStableKeys } from './stableKey/collectCoyoteOccupiedStableKeys'
import { finalizeStableKeysDeterministic } from './stableKey/finalizeStableKeysDeterministic'
import { runAcmeOrderAffinitiesHarness } from './actionHandlers/runAcmeOrderAffinitiesHarness'
import { runCoyoteEngineTestHarness } from '../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness'
import { isCoyoteGameRoom } from '../coyoteGame/utilities/isCoyoteGameRoom'

const COYOTE_ENGINE_TEST_HARNESS_ENABLED = true
const COYOTE_AFFINITIES_TEST_HARNESS_ENABLED = true

type ParseCommandAcmeOrderValidLine = Extract<ParseCommandAcmeOrderLine, { valid: true }>
type ParseCommandAcmeOrderInvalidLine = Extract<ParseCommandAcmeOrderLine, { valid: false }>

const buildPublishedAcmeOrdersWithStableKeys = (
    orders: ParseCommandAcmeOrderLine[],
    coyoteOccupiedStableKeys: ReadonlySet<string>,
): AcmeOrderPublishedOrder[] => {
    const validLines = orders.filter((line): line is ParseCommandAcmeOrderValidLine => line.valid)
    const finalizedKeys = finalizeStableKeysDeterministic(
        validLines.map((line) => ({ name: line.name, proposedStableKey: line.stableKey })),
        coyoteOccupiedStableKeys,
    )
    return validLines.map((line, index) => ({
        shortName: line.name.trim(),
        stableKey: finalizedKeys[index],
        ...(line.tropeAffinities !== undefined ? { tropeAffinities: line.tropeAffinities } : {}),
        ...(line.tropeAffinitiesFailed === true ? { tropeAffinitiesFailed: true as const } : {}),
    }))
}

const invalidAcmeOrderMessages = (orders: ParseCommandAcmeOrderLine[]): string[] => (
    orders
        .filter((line): line is ParseCommandAcmeOrderInvalidLine => !line.valid)
        .map(({ name, errorType }) => {
            switch (errorType) {
                case 'Not a thing':
                    return `The courier apologizes: ${name} is not in the catalog.`
                case 'Not tangible':
                    return `The courier apologizes: Acme only sells tangible objects, ${name} doesn't qualify`
                case 'Too large':
                    return `The courier apologizes: You couldn't afford the shipping on ${name}`
                case 'Celebrity cameo':
                    return 'The courier apologizes: Acme no longer arranges celebrity cameos. Complaints about this policy should be directed to Yakko, Wakko, and Dot at the Warner lot. They know what they did.'
                default:
                    return `The courier apologizes: ${name} cannot be delivered.`
            }
        })
)

const linesToRenderTree = (lines: string[]): RenderTree => (
    lines.flatMap((line, index) => (
        index === 0
            ? [line]
            : [{ data: { tag: 'br' as const }, children: [] }, line]
    ))
)

const parseErrorMessageForPlayer = (errorMessage?: string): string => {
    switch (errorMessage) {
        // Surfaced by plan/matchNavigationParaphrase.ts (iteration 7, Sub-iteration 2,
        // 2026-07-20) when an explicit movement verb makes a failed exit resolution
        // unambiguous. deterministicChecks.ts's maybeDeterministicNavigationResult
        // (bare `go <exit>` / verbless candidate) stays lenient and never constructs
        // these -- see exitResolution.ts's navigationIntentErrorMessages doc comment.
        case navigationIntentErrorMessages.noExitContext:
            return 'You are not in a room, so you cannot go anywhere.'
        case navigationIntentErrorMessages.noMatch:
            return 'There is no exit to that place from here.'
        case navigationIntentErrorMessages.ambiguousMatch:
            return "I can't tell which exit you mean from here."
        case objectManipulationErrorMessages.noCatalog:
            return "There is nothing here you can pick up."
        case objectManipulationErrorMessages.noMatch:
            return "You do not see that object here."
        case objectManipulationErrorMessages.ambiguousMatch:
            return "I can't tell which object you mean."
        case objectManipulationErrorMessages.notCarryingObject:
            return 'You are not carrying that.'
        case objectManipulationErrorMessages.alreadyHoldingObject:
            return 'You are already holding that.'
        case objectManipulationErrorMessages.noHostRoom:
            return 'You are not in a room, so you cannot do that.'
        case objectManipulationErrorMessages.notOnHostGraph:
            return 'You do not see that object here.'
        case objectManipulationErrorMessages.dissolveNoMatchingEdge:
            return 'There is no such relation to remove.'
        case objectManipulationErrorMessages.nestingRelational:
            return 'Putting something inside another object is not supported yet.'
        case objectManipulationErrorMessages.complexRelational:
        case objectManipulationErrorMessages.complexMultiObject:
        case objectManipulationErrorMessages.complexUnimplementedVerb:
        case objectManipulationErrorMessages.unimplementedAtomicOperation:
            return "That kind of object manipulation is not implemented yet."
        case objectManipulationErrorMessages.enrichInvokeFailed:
        case objectManipulationErrorMessages.enrichParseFailed:
            return "I couldn't understand how you want to manipulate that object."
        default:
            return errorMessage ?? 'Parse error'
    }
}

/** v1 OOC stub: perception owns steady-state Consult copy; actions assembles from structured alternatives. */
const consultMessageForPlayer = (
    alternatives: readonly ParseCommandConsultAlternative[]
): string => {
    const quoted = alternatives.map((alternative) => `"${alternative.proposedCommand}"`)
    if (quoted.length === 1) {
        return `Did you mean ${quoted[0]}?`
    }
    if (quoted.length === 2) {
        return `Did you mean ${quoted[0]} or ${quoted[1]}?`
    }
    const head = quoted.slice(0, -1).join(', ')
    const last = quoted[quoted.length - 1]
    return `Did you mean ${head}, or ${last}?`
}

type ResponseContext = {
    characterId: EphemeraCharacterId
    roomExitContext: RoomExitTargetsForCharacter
    coyoteOccupiedStableKeys: ReadonlySet<string>
    parseResult: ParseCommandResult
}

const respondImperativelyForIntent = async ({ characterId, parseResult }: ResponseContext): Promise<void> => {
    if (isParseCommandErrorResult(parseResult)) {
        const line = parseErrorMessageForPlayer(parseResult.errorMessage)
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [line],
        })
    }
    else if (isParseCommandConsultResult(parseResult)) {
        const line = consultMessageForPlayer(parseResult.alternatives)
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [line],
        })
    }
    else if (isParseCommandAbstainResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: ["I couldn't understand that command."],
        })
    }
    else if (isParseCommandCoyoteEngineTestResult(parseResult)) {
        if (!COYOTE_ENGINE_TEST_HARNESS_ENABLED) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['Coyote engine test harness is currently disabled.'],
            })
        }
        else {
            await runCoyoteEngineTestHarness({
                characterId,
                messageBus,
                ...(parseResult.harnessInvocation !== undefined
                    ? { harnessInvocation: parseResult.harnessInvocation }
                    : {}),
            })
        }
    }
    else if (isParseCommandCoyoteAffinitiesTestResult(parseResult)) {
        if (!COYOTE_AFFINITIES_TEST_HARNESS_ENABLED) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['Acme affinities test harness is currently disabled.'],
            })
        }
        else {
            await runAcmeOrderAffinitiesHarness({
                characterId,
                messageBus,
                ...(parseResult.harnessInvocation !== undefined
                    ? { harnessInvocation: parseResult.harnessInvocation }
                    : {}),
            })
        }
    }
    else if (isParseCommandUnimplementedResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [
                "I can tell you're trying to do something that hasn't been implemented in the game yet, sorry.",
            ],
        })
    }
    else if (isParseCommandPromptInjectionAttemptResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [
                "Prompt injection isn't going to get you any closer to catching the Road Runner.",
            ],
        })
    }
    else if (isParseCommandMultipleCommandsResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [MULTIPLE_COMMANDS_PLAYER_MESSAGE],
        })
    }
    else if (isParseCommandHelpResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'CoyoteGameHelpMessage',
        })
    }
    else if (isParseCommandUnknownResult(parseResult)) {
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [
                "I'm sorry, I can't tell what you're trying to tell me to do.",
            ],
        })
    }
}

const publishStreamEventsForIntent = async (
    {
        characterId,
        roomExitContext,
        coyoteOccupiedStableKeys,
        parseResult,
    }: ResponseContext,
    streamEvent: (event: {
        streamKey: string
        header: { type: string }
        update: Record<string, unknown>
    }) => Promise<void>
): Promise<void> => {
    if (isParseCommandNavigationResult(parseResult)) {
        const { fromRoomId, toRoomIds } = roomExitContext
        if (!fromRoomId) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot go anywhere.'],
            })
        }
        else if (!toRoomIds.includes(parseResult.targetId)) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['There is no exit to that place from here.'],
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Character Navigate' },
                update: {
                    type: 'Character Navigate',
                    characterId,
                    fromRoomId,
                    toRoomId: parseResult.targetId,
                    ...(parseResult.exitName !== undefined ? { exitName: parseResult.exitName } : {}),
                },
            })
        }
    }
    else if (isParseCommandHomeResult(parseResult)) {
        const resolution = await resolveHomeTargetForCharacter(characterId)
        if (resolution.type === 'NoExitContext') {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot go anywhere.'],
            })
        }
        else if (resolution.type === 'AlreadyHome') {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are already home.'],
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Character Home' },
                update: {
                    type: 'Character Home',
                    characterId,
                    fromRoomId: resolution.fromRoomId,
                    toRoomId: resolution.toRoomId,
                },
            })
        }
    }
    else if (isParseCommandLookRoomResult(parseResult)) {
        const { fromRoomId } = roomExitContext
        if (!fromRoomId) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot go anywhere.'],
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Look Command Requested' },
                update: {
                    type: 'Look Command Requested',
                    characterId,
                    componentId: fromRoomId,
                    confidence: parseResult.confidence,
                },
            })
        }
    }
    else if (isParseCommandLookComponentResult(parseResult)) {
        await streamEvent({
            streamKey: characterId,
            header: { type: 'Look Command Requested' },
            update: {
                type: 'Look Command Requested',
                characterId,
                componentId: parseResult.componentId,
                confidence: parseResult.confidence,
                ...(parseResult.directResponse ? { directResponse: true } : {}),
            },
        })
    }
    else if (isParseCommandCharacterSpokeResult(parseResult)) {
        await streamEvent({
            streamKey: characterId,
            header: { type: 'Character Spoke' },
            update: {
                type: 'Character Spoke',
                characterId,
                message: parseResult.message,
                displayProtocol: parseResult.displayProtocol,
                confidence: parseResult.confidence,
            },
        })
    }
    else if (isParseCommandAcmeOrderResult(parseResult)) {
        const orders = buildPublishedAcmeOrdersWithStableKeys(parseResult.orders, coyoteOccupiedStableKeys)
        await streamEvent({
            streamKey: characterId,
            header: { type: 'Acme Order' },
            update: {
                type: 'Acme Order',
                characterId,
                orders,
                confidence: parseResult.confidence,
            },
        })
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldMessage',
            message: linesToRenderTree([
                ...(orders.length > 0 ? ['An Acme courier delivers your order'] : []),
                ...invalidAcmeOrderMessages(parseResult.orders),
            ]),
        })
    }
    else if (isParseCommandAwaitRoadrunnerResult(parseResult)) {
        await streamEvent({
            streamKey: characterId,
            header: { type: 'Await RoadRunner' },
            update: {
                type: 'Await RoadRunner',
                characterId,
                confidence: parseResult.confidence,
            },
        })
        messageBus.publish({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: ['Awaiting Road Runner'],
        })
    }
    else if (isParseCommandPredictHypothesisResult(parseResult)) {
        const { fromRoomId } = roomExitContext
        if (!fromRoomId || !(await isCoyoteGameRoom(fromRoomId))) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You can only predict your Coyote plan from a Coyote Game room.'],
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Predict Hypothesis' },
                update: {
                    type: 'Predict Hypothesis',
                    characterId,
                    confidence: parseResult.confidence,
                },
            })
        }
    }
    else if (isParseCommandObjectManipulationResult(parseResult)) {
        const { fromRoomId } = roomExitContext
        if (!fromRoomId) {
            const noRoomMessage = parseResult.operationKind === 'drop'
                ? 'You are not in a room, so you cannot drop that.'
                : 'You are not in a room, so you cannot pick that up.'
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: [noRoomMessage],
            })
        }
        else if (parseResult.operationKind === 'drop') {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Object Drop' },
                update: {
                    type: 'Object Drop',
                    characterId,
                    objectIds: parseResult.objectIds,
                    roomId: fromRoomId,
                    confidence: parseResult.confidence,
                },
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Object Take Hold' },
                update: {
                    type: 'Object Take Hold',
                    characterId,
                    objectIds: parseResult.objectIds,
                    roomId: fromRoomId,
                    confidence: parseResult.confidence,
                },
            })
        }
    }
    else if (isParseCommandEstablishRelationResult(parseResult)) {
        const { hostId } = parseResult
        if (!hostId) {
            messageBus.publish({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot do that.'],
            })
        }
        else if (parseResult.operationKind === 'dissolveRelation') {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Object Dissolve Relation' },
                update: {
                    type: 'Object Dissolve Relation',
                    characterId,
                    subjectId: parseResult.subjectId,
                    targetId: parseResult.targetId,
                    hostId,
                    relationKind: parseResult.relationKind,
                    ...(parseResult.relationLabel !== undefined
                        ? { relationLabel: parseResult.relationLabel }
                        : {}),
                    confidence: parseResult.confidence,
                    ...(parseResult.transferFromHostId !== undefined
                        ? { transferFromHostId: parseResult.transferFromHostId }
                        : {}),
                },
            })
        }
        else {
            await streamEvent({
                streamKey: characterId,
                header: { type: 'Object Establish Relation' },
                update: {
                    type: 'Object Establish Relation',
                    characterId,
                    subjectId: parseResult.subjectId,
                    targetId: parseResult.targetId,
                    hostId,
                    relationKind: parseResult.relationKind,
                    ...(parseResult.relationLabel !== undefined
                        ? { relationLabel: parseResult.relationLabel }
                        : {}),
                    confidence: parseResult.confidence,
                    ...(parseResult.transferFromHostId !== undefined
                        ? { transferFromHostId: parseResult.transferFromHostId }
                        : {}),
                },
            })
        }
    }
}

type StreamEventFn = (event: {
    streamKey: string
    header: { type: string }
    update: Record<string, unknown>
}) => Promise<void>

const processAssessedParseResult = async (
    responseContext: ResponseContext,
    streamEvent: StreamEventFn,
): Promise<void> => {
    await respondImperativelyForIntent(responseContext)
    await publishStreamEventsForIntent(responseContext, streamEvent)
}

const publishReturnValueForRequest = (requestId: string | undefined, message: string): void => {
    if (requestId) {
        messageBus.publish({
            type: 'ReturnValue',
            body: {
                messageType: 'Success',
                RequestId: requestId,
                message,
            },
        })
    }
}

const handleParseRequested = async (
    content: ParseRequestedCommand,
    streamEvent: StreamEventFn,
): Promise<void> => {
    if (!isEphemeraCharacterId(content.characterId)) {
        return
    }
    messageBus.publish({
        type: 'PublishMessage',
        targets: [content.characterId],
        displayProtocol: 'CommandTranscriptMessage',
        message: linesToRenderTree([content.command.trim()]),
    })
    const [roomExitContext, roomObjectCatalogResult, heldInventoryCatalogResult] = await Promise.all([
        getRoomExitTargetsForCharacter(content.characterId),
        getRoomObjectCatalogForCharacter(content.characterId),
        getHeldInventoryCatalogForCharacter(content.characterId),
    ])
    const catalogObjectIds = catalogObjectIdsUnion(
        roomObjectCatalogResult.entries,
        heldInventoryCatalogResult.entries
    )
    const embeddingMap = catalogObjectIds.length > 0
        ? await internalCache.ObjectEmbedding.get(catalogObjectIds)
        : {}
    const roomObjectCatalog = attachEmbeddingsToCatalogEntries(
        roomObjectCatalogResult.entries,
        embeddingMap
    )
    const heldInventoryCatalog = attachEmbeddingsToCatalogEntries(
        heldInventoryCatalogResult.entries,
        embeddingMap
    )
    const roomObjectLabels = [
        ...new Set([
            ...roomObjectLabelsFromCatalog(roomObjectCatalog),
            ...roomObjectLabelsFromCatalog(heldInventoryCatalog),
        ]),
    ]
    const coyoteOccupiedStableKeys = await collectCoyoteOccupiedStableKeys()
    const parseResult = await parseCommand({
        command: content.command,
        characterId: content.characterId,
        hostRoomId: roomExitContext.fromRoomId ?? undefined,
        roomExits: roomExitContext.exits.map(({ normalizedName, toRoomId }) => ({
            normalizedName,
            targetId: toRoomId,
        })),
        roomObjectLabels,
        roomObjectCatalog,
        heldInventoryCatalog,
        occupiedStableKeys: [...coyoteOccupiedStableKeys],
    }, { messageBus })
    const responseContext: ResponseContext = {
        characterId: content.characterId,
        roomExitContext,
        coyoteOccupiedStableKeys,
        parseResult,
    }

    await processAssessedParseResult(responseContext, streamEvent)
    publishReturnValueForRequest(content.requestId, 'parse_request_handled')
}

const handleActionAssessed = async (
    content: ActionAssessedCommand,
    streamEvent: StreamEventFn,
): Promise<void> => {
    if (!isActionAssessedCommand(content)) {
        return
    }
    const roomExitContext = await getRoomExitTargetsForCharacter(content.characterId)
    const coyoteOccupiedStableKeys = await collectCoyoteOccupiedStableKeys()
    const responseContext: ResponseContext = {
        characterId: content.characterId,
        roomExitContext,
        coyoteOccupiedStableKeys,
        parseResult: content.assessed,
    }

    await processAssessedParseResult(responseContext, streamEvent)
    publishReturnValueForRequest(content.requestId, 'action_assessed_handled')
}

export const ephemeraActionsDataSource = new EphemeraDataSource<
    never,
    ActionsPublishedPayload,
    ActionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.actions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isActionsSubscribedEnvelope,
    receiveEvents: async ({ events, streamEvent }) => {
        const streamEventFn = streamEvent as StreamEventFn
        await Promise.all(events.map(async (event) => {
            if (isActionsParseRequestedEnvelope(event)) {
                const content = await event.getContent()
                if (!isParseRequestedCommand(content)) {
                    return
                }
                await handleParseRequested(content, streamEventFn)
                return
            }
            if (isActionsActionAssessedEnvelope(event)) {
                const content = await event.getContent()
                await handleActionAssessed(content, streamEventFn)
            }
        }))
    },
})

ephemeraActionsDataSource.subscribe()

export default ephemeraActionsDataSource
