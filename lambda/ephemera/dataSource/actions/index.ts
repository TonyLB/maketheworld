/**
 * mtw.ephemera.actions DataSource.
 *
 * Inert bus-only stub for local coordination scaffolding. Ingress wiring follows.
 */
import { isEphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import EphemeraDataSource from '../abstract'
import type { ActionsStubPublishedPayload } from './publishedEvents'
import type { ActionsSubscribedContent } from './subscribedEvents'
import { isActionsSubscribedEnvelope } from './subscribedEvents'
import messageBus from '../../messageBus'
import { isParseCommandErrorResult, parseCommand } from './parseCommand'

export const ephemeraActionsDataSource = new EphemeraDataSource<
    never,
    ActionsStubPublishedPayload,
    ActionsSubscribedContent
>({
    dataSourceKey: 'mtw.ephemera.actions',
    replayable: false,
    publisherStrategy: 'busOnly',
    subscribedEventTypeGuard: isActionsSubscribedEnvelope,
    receiveEvents: async ({ events }) => {
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
