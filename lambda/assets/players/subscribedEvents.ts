/**
 * mtw.assets.players DataSource subscription surface: types, envelope type guards,
 * and typed send-helper for the internal Player Settings Updated event.
 */
import { StreamingEventHeader, StreamingEventEnvelope, HeaderGuard, makeStreamingEnvelopeGuardFromHeaderGuard } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { createInternalOriginEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource'
import {
    PlayerSettingsUpdatedEvent,
} from './localApiEvents'
import {
    AssetAddedEventUpdate,
    AssetLevelEventUpdate,
    AssetRemovedEventUpdate,
    AssetUpdatedEventUpdate,
    ZoneUpdatedEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

/** Payload types of events mtw.assets.players subscribes to (internal + mtw.assets). */
export type PlayersSubscribedContent = PlayerSettingsUpdatedEvent | AssetLevelEventUpdate

/** Header union for events mtw.assets.players subscribes to. */
export type PlayersSubscribedHeader =
    | (StreamingEventHeader & { dataSourceKey: 'api.assets'; type: 'Player Settings Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' })
    | (StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' })

/**
 * Envelope-level discriminated union for events subscribed by mtw.assets.players.
 * Each variant pairs a narrow header (dataSourceKey + type) with getContent returning the matching content shape.
 */
export type PlayersIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'api.assets'; type: 'Player Settings Updated' }; getContent: () => Promise<PlayerSettingsUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' }; getContent: () => Promise<AssetAddedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }; getContent: () => Promise<AssetRemovedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }; getContent: () => Promise<AssetUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContent: () => Promise<ZoneUpdatedEventUpdate> }

const isPlayerSettingsHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'api.assets'; type: 'Player Settings Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'api.assets'; type: 'Player Settings Updated' } =>
    h.dataSourceKey === 'api.assets' && h.type === 'Player Settings Updated'
const isPlayersAssetRemovedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Removed'
const isPlayersAssetAddedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Added'
const isPlayersZoneUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Zone Updated'
const isPlayersAssetUpdatedHeader: HeaderGuard<StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }> = (h): h is StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' } =>
    h.dataSourceKey === 'mtw.assets' && h.type === 'Asset Updated'

export const isPlayerSettingsEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<PlayerSettingsUpdatedEvent, StreamingEventHeader & { dataSourceKey: 'api.assets'; type: 'Player Settings Updated' }>(isPlayerSettingsHeader)
export const isPlayersAssetRemovedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetRemovedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }>(isPlayersAssetRemovedHeader)
export const isPlayersAssetAddedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetAddedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' }>(isPlayersAssetAddedHeader)
export const isPlayersZoneUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<ZoneUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }>(isPlayersZoneUpdatedHeader)
export const isPlayersAssetUpdatedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<AssetUpdatedEventUpdate, StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }>(isPlayersAssetUpdatedHeader)

export const isPlayersSubscribedHeader: HeaderGuard<PlayersSubscribedHeader> = (header): header is PlayersSubscribedHeader =>
    isPlayerSettingsHeader(header) ||
    isPlayersAssetRemovedHeader(header) ||
    isPlayersAssetAddedHeader(header) ||
    isPlayersZoneUpdatedHeader(header) ||
    isPlayersAssetUpdatedHeader(header)

export const isPlayersSubscribedEnvelope = makeStreamingEnvelopeGuardFromHeaderGuard<PlayersSubscribedContent, PlayersSubscribedHeader>(isPlayersSubscribedHeader)

type Bus = { publish: (payload: StreamingEventMessage) => void }

const apiAssetsSerializer = { serialize: ({ content, header }: { content: object; header: StreamingEventHeader }) => ({ type: header.type, ...content }) }

export function sendPlayerSettingsUpdated(bus: Bus, streamKey: string, content: PlayerSettingsUpdatedEvent): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'api.assets',
        streamKey,
        timestamp,
        type: 'Player Settings Updated',
    }
    const envelope = createInternalOriginEnvelope(header, content, apiAssetsSerializer)
    bus.publish({
        type: 'StreamingEvent',
        dataSourceKey: 'api.assets',
        streamKey,
        header: envelope.header,
        getContent: envelope.getContent,
        timestamp,
    })
}
