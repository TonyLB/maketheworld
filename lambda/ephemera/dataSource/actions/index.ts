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
import { isActionsSubscribedEnvelope } from './subscribedEvents'
import messageBus from '../../messageBus'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import type { RoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import {
    type ParseCommandAcmeOrderLine,
    type ParseCommandResult,
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandCoyoteAffinitiesTestResult,
    isParseCommandCoyoteEngineTestResult,
    isParseCommandErrorResult,
    isParseCommandHelpResult,
    isParseCommandLookRoomResult,
    isParseCommandMultipleCommandsResult,
    isParseCommandNavigationResult,
    isParseCommandPromptInjectionAttemptResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'
import { MULTIPLE_COMMANDS_PLAYER_MESSAGE } from './multipleCommandsPlayerMessage'
import { parseCommand } from './parseCommand'
import { navigationIntentErrorMessages } from './parseCommand'
import { collectCoyoteOccupiedStableKeys } from './stableKey/collectCoyoteOccupiedStableKeys'
import { finalizeStableKeysDeterministic } from './stableKey/finalizeStableKeysDeterministic'
import { runAcmeOrderAffinitiesHarness } from './actionHandlers/runAcmeOrderAffinitiesHarness'
import { runCoyoteEngineTestHarness } from '../coyoteGame/generators/testHarness/runCoyoteEngineTestHarness'

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
        affinities: line.affinities,
        ...(line.affinitiesFailed === true ? { affinitiesFailed: true as const } : {}),
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
        case navigationIntentErrorMessages.noExitContext:
            return 'You are not in a room, so you cannot go anywhere.'
        case navigationIntentErrorMessages.noMatch:
            return 'There is no exit to that place from here.'
        case navigationIntentErrorMessages.ambiguousMatch:
            return "I can't tell which exit you mean from here."
        default:
            return errorMessage ?? 'Parse error'
    }
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
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [line],
        })
    }
    else if (isParseCommandCoyoteEngineTestResult(parseResult)) {
        if (!COYOTE_ENGINE_TEST_HARNESS_ENABLED) {
            messageBus.send({
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
            })
        }
    }
    else if (isParseCommandCoyoteAffinitiesTestResult(parseResult)) {
        if (!COYOTE_AFFINITIES_TEST_HARNESS_ENABLED) {
            messageBus.send({
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
            })
        }
    }
    else if (isParseCommandUnimplementedResult(parseResult)) {
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [
                "I can tell you're trying to do something that hasn't been implemented in the game yet, sorry.",
            ],
        })
    }
    else if (isParseCommandPromptInjectionAttemptResult(parseResult)) {
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [
                "Prompt injection isn't going to get you any closer to catching the Road Runner.",
            ],
        })
    }
    else if (isParseCommandMultipleCommandsResult(parseResult)) {
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: [MULTIPLE_COMMANDS_PLAYER_MESSAGE],
        })
    }
    else if (isParseCommandHelpResult(parseResult)) {
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'CoyoteGameHelpMessage',
        })
    }
    else if (isParseCommandUnknownResult(parseResult)) {
        messageBus.send({
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
            messageBus.send({
                type: 'PublishMessage',
                targets: [characterId],
                displayProtocol: 'WorldOOCMessage',
                message: ['You are not in a room, so you cannot go anywhere.'],
            })
        }
        else if (!toRoomIds.includes(parseResult.targetId)) {
            messageBus.send({
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
                },
            })
            messageBus.send({
                type: 'MoveCharacter',
                characterId,
                roomId: parseResult.targetId,
            })
        }
    }
    else if (isParseCommandLookRoomResult(parseResult)) {
        const { fromRoomId } = roomExitContext
        if (!fromRoomId) {
            messageBus.send({
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
                    roomId: fromRoomId,
                    confidence: parseResult.confidence,
                },
            })
        }
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
        messageBus.send({
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
        messageBus.send({
            type: 'PublishMessage',
            targets: [characterId],
            displayProtocol: 'WorldOOCMessage',
            message: ['Awaiting Road Runner'],
        })
    }
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
        await Promise.all(events.map(async (event) => {
            const content = await event.getContent()
            if (!isEphemeraCharacterId(content.characterId)) {
                return
            }
            const roomExitContext = await getRoomExitTargetsForCharacter(content.characterId)
            const coyoteOccupiedStableKeys = await collectCoyoteOccupiedStableKeys()
            const parseResult = await parseCommand({
                command: content.command,
                roomExits: roomExitContext.exits.map(({ normalizedName, toRoomId }) => ({
                    normalizedName,
                    targetId: toRoomId,
                })),
                occupiedStableKeys: [...coyoteOccupiedStableKeys],
            })
            const responseContext: ResponseContext = {
                characterId: content.characterId,
                roomExitContext,
                coyoteOccupiedStableKeys,
                parseResult,
            }

            await respondImperativelyForIntent(responseContext)
            await publishStreamEventsForIntent(responseContext, streamEvent as (event: {
                streamKey: string
                header: { type: string }
                update: Record<string, unknown>
            }) => Promise<void>)

            if (content.requestId) {
                messageBus.send({
                    type: 'ReturnValue',
                    body: {
                        messageType: 'Success',
                        RequestId: content.requestId,
                        message: 'Parse request accepted',
                    },
                })
            }
        }))
    },
})

ephemeraActionsDataSource.subscribe()

export default ephemeraActionsDataSource
