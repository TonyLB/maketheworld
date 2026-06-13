/**
 * Legacy-to-DataSource bridge: direct `messageBus.publish` of `mtw.ephemera.actions`
 * stream envelopes from code **outside** `ephemeraActionsDataSource.receiveEvents`.
 *
 * Steady-state path for actions outbounds is `streamEvent` inside `receiveEvents`
 * (see `publishStreamEventsForIntent` in `index.ts` for `Character Navigate`). Helpers
 * here exist only while legacy ingress (e.g. `parse/executeAction`) has not been routed
 * through `Parse Requested` / `parseCommand`.
 *
 * **Dispose** each helper when its caller migrates to the actions DataSource; do not treat
 * these as long-term authoritative publish APIs. Parallels `sendRenderRequested` /
 * `sendPerceptionThreadRegistered` on other legacy cross-module kicks.
 */
import {
    StreamingEventHeader,
} from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { MessageBus, StreamingEventMessage } from '../../messageBus/baseClasses'
import type { CharacterHomePublishedPayload } from './publishedEvents'

export const EPHEMERA_ACTIONS_DATA_SOURCE_KEY = 'mtw.ephemera.actions' as const

type PublishBus = Pick<MessageBus, 'publish'>

const actionsSerializer = {
    serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({
        type: header.type,
        ...content,
    }),
}

/**
 * Legacy bridge for `Character Home` until home runs through actions `receiveEvents`
 * (`streamEvent`, like `Character Navigate`). Remove when `executeAction` `case 'home'`
 * is retired or re-homed to `Parse Requested`.
 *
 * streamKey should be the moving character id (CHARACTER#...).
 */
export function sendCharacterHome(
    bus: PublishBus,
    streamKey: string,
    content: CharacterHomePublishedPayload,
): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
        streamKey,
        timestamp,
        type: 'Character Home',
    }
    const envelope = createInternalOriginEnvelope(header, content, actionsSerializer)
    const message: StreamingEventMessage = {
        type: 'StreamingEvent',
        dataSourceKey: EPHEMERA_ACTIONS_DATA_SOURCE_KEY,
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    }
    bus.publish(message)
}
