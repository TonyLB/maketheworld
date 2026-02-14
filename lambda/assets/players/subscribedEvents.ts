/**
 * mtw.assets.players DataSource subscription surface: types, envelope type guards,
 * and typed send-helper for the internal Player Settings Updated event.
 */
import { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerSettingsUpdatedEvent,
} from './coordinationSerializer'
import {
    AssetLevelEventUpdate,
} from '@tonylb/mtw-interfaces/ts/eventBridge/assets'
import type { StreamingEventMessage } from '../messageBus/baseClasses'

export const PLAYERS_ASSET_EVENT_TYPES = new Set(['Asset Added', 'Asset Removed', 'Asset Updated', 'Zone Updated'])
export const PLAYER_SETTINGS_TYPE = 'Player Settings Updated'

/** Payload types of events mtw.assets.players subscribes to (internal + mtw.assets). */
export type PlayersSubscribedContent = PlayerSettingsUpdatedEvent | AssetLevelEventUpdate

export type PlayersIncomingEvent =
    | { header: StreamingEventHeader & { dataSourceKey: 'internal'; type: 'Player Settings Updated' }; getContentInternal: () => Promise<PlayerSettingsUpdatedEvent> }
    | { header: StreamingEventHeader & { dataSourceKey: 'mtw.assets'; type: 'Asset Added' | 'Asset Removed' | 'Asset Updated' | 'Zone Updated' }; getContentInternal: () => Promise<AssetLevelEventUpdate> }

export const isPlayerSettingsEnvelope = (event: { header: StreamingEventHeader }): event is Extract<PlayersIncomingEvent, { header: { dataSourceKey: 'internal' } }> =>
    event.header.dataSourceKey === 'internal' && event.header.type === PLAYER_SETTINGS_TYPE
export const isPlayersAssetEnvelope = (event: { header: StreamingEventHeader }): event is Extract<PlayersIncomingEvent, { header: { dataSourceKey: 'mtw.assets' } }> =>
    event.header.dataSourceKey === 'mtw.assets' && PLAYERS_ASSET_EVENT_TYPES.has(event.header.type)

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
        content,
        getContentInternal: () => Promise.resolve(content),
        timestamp,
    })
}
