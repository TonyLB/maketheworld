/**
 * mtw.assets.players DataSource subscription surface: types, envelope type guards,
 * and typed send-helper for the internal Player Settings Updated event.
 */
import { StreamingEventHeader, StreamingEventEnvelope } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerSettingsUpdatedEvent,
} from './coordinationSerializer'
import {
    AssetAddedEventUpdate,
    AssetLevelEventUpdate,
    AssetRemovedEventUpdate,
    AssetUpdatedEventUpdate,
    ZoneUpdatedEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export const PLAYERS_ASSET_EVENT_TYPES = new Set(['Asset Added', 'Asset Removed', 'Asset Updated', 'Zone Updated'])
export const PLAYER_SETTINGS_TYPE = 'Player Settings Updated'

/** Payload types of events mtw.assets.players subscribes to (internal + mtw.assets). */
export type PlayersSubscribedContent = PlayerSettingsUpdatedEvent | AssetLevelEventUpdate

/**
 * Envelope-level discriminated union for events subscribed by mtw.assets.players.
 * Each variant pairs a narrow header (dataSourceKey + type) with getContentInternal returning the matching content shape.
 */
export type PlayersIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Player Settings Updated' }; getContentInternal: () => Promise<PlayerSettingsUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' }; getContentInternal: () => Promise<AssetAddedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Removed' }; getContentInternal: () => Promise<AssetRemovedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Updated' }; getContentInternal: () => Promise<AssetUpdatedEventUpdate> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Zone Updated' }; getContentInternal: () => Promise<ZoneUpdatedEventUpdate> }

export const isPlayerSettingsEnvelope = (event: { header: StreamingEventHeader }): event is Extract<PlayersIncomingEvent, { header: { dataSourceKey: 'internal' } }> =>
    event.header.dataSourceKey === 'internal' && event.header.type === PLAYER_SETTINGS_TYPE

export const isPlayersAssetRemovedEnvelope = (event: StreamingEventEnvelope<PlayersSubscribedContent>): event is Extract<PlayersIncomingEvent, { header: { type: 'Asset Removed' } }> =>
    event.header.dataSourceKey === 'mtw.assets' && event.header.type === 'Asset Removed'
export const isPlayersAssetAddedEnvelope = (event: StreamingEventEnvelope<PlayersSubscribedContent>): event is Extract<PlayersIncomingEvent, { header: { type: 'Asset Added' } }> =>
    event.header.dataSourceKey === 'mtw.assets' && event.header.type === 'Asset Added'
export const isPlayersZoneUpdatedEnvelope = (event: StreamingEventEnvelope<PlayersSubscribedContent>): event is Extract<PlayersIncomingEvent, { header: { type: 'Zone Updated' } }> =>
    event.header.dataSourceKey === 'mtw.assets' && event.header.type === 'Zone Updated'
export const isPlayersAssetUpdatedEnvelope = (event: StreamingEventEnvelope<PlayersSubscribedContent>): event is Extract<PlayersIncomingEvent, { header: { type: 'Asset Updated' } }> =>
    event.header.dataSourceKey === 'mtw.assets' && event.header.type === 'Asset Updated'

export function isPlayersSubscribedEnvelope(e: StreamingEventEnvelope<unknown>): e is StreamingEventEnvelope<PlayersSubscribedContent> {
    if (e.header.dataSourceKey === 'internal') return e.header.type === PLAYER_SETTINGS_TYPE
    if (e.header.dataSourceKey === 'mtw.assets') return PLAYERS_ASSET_EVENT_TYPES.has(e.header.type)
    return false
}

type Bus = { send: (payload: StreamingEventMessage) => void }

export function sendPlayerSettingsUpdated(bus: Bus, streamKey: string, content: PlayerSettingsUpdatedEvent): void {
    const timestamp = Date.now()
    const header: StreamingEventHeader = {
        dataSourceKey: 'internal',
        streamKey,
        timestamp,
        type: content.type,
    }
    bus.send({
        type: 'StreamingEvent',
        dataSourceKey: 'internal',
        streamKey,
        header,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}
