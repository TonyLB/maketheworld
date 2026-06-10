import { HeaderGuard, StreamingEventHeader, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export type AssetsAPIPayload =
    | {
          type: 'HealPlayer'
          player: string
      }
    | {
          type: 'HealComponentVertical'
          assetId: string
          componentUniversalKeys?: string[]
      }

export type AssetsApiSubscribedHeader =
    | (StreamingEventHeader & {
          dataSourceKey: 'api.assets'
          type: 'HealPlayer'
      })
    | (StreamingEventHeader & {
          dataSourceKey: 'api.assets'
          type: 'HealComponentVertical'
      })

const isApiAssetsHeader: HeaderGuard<AssetsApiSubscribedHeader> = (
    header
): header is AssetsApiSubscribedHeader =>
    header.dataSourceKey === 'api.assets' &&
    (header.type === 'HealPlayer' || header.type === 'HealComponentVertical')

export const isApiAssetsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<
    AssetsAPIPayload,
    AssetsApiSubscribedHeader
>(isApiAssetsHeader)

type Bus = { publish: (payload: StreamingEventMessage) => void }

const apiAssetsSerializer = {
    serialize: ({ content }: { content: AssetsAPIPayload; header: { type: string } }) => ({ ...content })
}

export const sendApiAssetsEvent = (
    bus: Bus,
    content: AssetsAPIPayload,
) => {
    const timestamp = Date.now()
    const envelope = createInternalOriginEnvelope(
        {
            dataSourceKey: 'api.assets',
            streamKey: 'ingress',
            timestamp,
            type: content.type
        },
        content,
        apiAssetsSerializer
    )
    bus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'api.assets',
        streamKey: 'ingress',
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp
    })
}
