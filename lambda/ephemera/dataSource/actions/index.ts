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
    isParseCommandErrorResult,
    isParseCommandNavigationResult,
    parseCommand,
} from './parseCommand'

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
