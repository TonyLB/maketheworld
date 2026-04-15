/**
 * mtw.ephemera.actions DataSource.
 *
 * Inert bus-only stub for local coordination scaffolding. Ingress wiring follows.
 */
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import EphemeraDataSource from '../abstract'
import type { ActionsPublishedPayload } from './publishedEvents'
import type { ActionsSubscribedContent } from './subscribedEvents'
import { isActionsSubscribedEnvelope } from './subscribedEvents'
import messageBus from '../../messageBus'
import { getRoomExitTargetsForCharacter } from './roomExitTargetsForCharacter'
import {
    type ParseCommandAcmeOrderLine,
    isParseCommandAcmeOrderResult,
    isParseCommandAwaitRoadrunnerResult,
    isParseCommandErrorResult,
    isParseCommandNavigationResult,
    isParseCommandUnimplementedResult,
    isParseCommandUnknownResult,
} from './baseClasses'
import { parseCommand } from './parseCommand'

const validAcmeOrderNames = (orders: ParseCommandAcmeOrderLine[]): string[] => (
    orders
        .filter(({ valid }) => valid)
        .map(({ name }) => name)
)

const invalidAcmeOrderMessages = (orders: ParseCommandAcmeOrderLine[]): string[] => (
    orders
        .filter(({ valid }) => !valid)
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
            const parseResult = await parseCommand({ command: content.command })
            if (isEphemeraCharacterId(content.characterId) && isParseCommandErrorResult(parseResult)) {
                const line = parseResult.errorMessage ?? 'Parse error'
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [content.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message: [line],
                })
            }
            else if (isEphemeraCharacterId(content.characterId) && isParseCommandNavigationResult(parseResult)) {
                const { fromRoomId, toRoomIds } = await getRoomExitTargetsForCharacter(content.characterId)
                if (!fromRoomId) {
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [content.characterId],
                        displayProtocol: 'WorldOOCMessage',
                        message: ['You are not in a room, so you cannot go anywhere.'],
                    })
                }
                else if (!toRoomIds.includes(parseResult.targetId)) {
                    messageBus.send({
                        type: 'PublishMessage',
                        targets: [content.characterId],
                        displayProtocol: 'WorldOOCMessage',
                        message: ['There is no exit to that place from here.'],
                    })
                }
                else {
                    await streamEvent({
                        streamKey: content.characterId,
                        header: { type: 'Character Navigate' },
                        update: {
                            type: 'Character Navigate',
                            characterId: content.characterId,
                            fromRoomId,
                            toRoomId: parseResult.targetId,
                        },
                    })
                }
            }
            else if (isEphemeraCharacterId(content.characterId) && isParseCommandAcmeOrderResult(parseResult)) {
                const orders = validAcmeOrderNames(parseResult.orders)
                await streamEvent({
                    streamKey: content.characterId,
                    header: { type: 'Acme Order' },
                    update: {
                        type: 'Acme Order',
                        characterId: content.characterId,
                        orders,
                        confidence: parseResult.confidence,
                    },
                })
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [content.characterId],
                    displayProtocol: 'WorldMessage',
                    message: [
                        ...(orders.length > 0 ? ['An Acme courier delivers your order'] : []),
                        ...invalidAcmeOrderMessages(parseResult.orders),
                    ],
                })
            }
            else if (isEphemeraCharacterId(content.characterId) && isParseCommandAwaitRoadrunnerResult(parseResult)) {
                await streamEvent({
                    streamKey: content.characterId,
                    header: { type: 'Await RoadRunner' },
                    update: {
                        type: 'Await RoadRunner',
                        characterId: content.characterId,
                        confidence: parseResult.confidence,
                    },
                })
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [content.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message: ['Awaiting Road Runner'],
                })
            }
            else if (isEphemeraCharacterId(content.characterId) && isParseCommandUnimplementedResult(parseResult)) {
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [content.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message: [
                        "I can tell you're trying to do something that hasn't been implemented in the game yet, sorry.",
                    ],
                })
            }
            else if (isEphemeraCharacterId(content.characterId) && isParseCommandUnknownResult(parseResult)) {
                messageBus.send({
                    type: 'PublishMessage',
                    targets: [content.characterId],
                    displayProtocol: 'WorldOOCMessage',
                    message: [
                        "I'm sorry, I can't tell what you're trying to tell me to do.",
                    ],
                })
            }
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
