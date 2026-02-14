// Player Data Source Event Contracts
//
// This file defines the EventBridge contracts for the planned mtw.assets.players
// data source. The data source will provide replayable player-centric snapshots
// and streaming updates that keep the client synchronized with a player's
// currently accessible assets, characters, and related library state.

import { DataSourceEventSerializer, ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import { LibraryAsset, LibraryCharacter } from '../../../library'
import { Zone, isZone } from '../../../baseClasses'
import { AssetClientPlayerSettings } from '../../../asset'
import { isRenderTree } from '@tonylb/mtw-base/ts/renderTree'

//
// Player snapshot and streaming event payloads
//

export type PlayerSnapshot = {
    type: 'Snapshot'
    assets: LibraryAsset[]
    characters: LibraryCharacter[]
    settings: AssetClientPlayerSettings
}

export type PlayerSettingsUpdated = {
    type: 'Player Settings Updated'
    settings: AssetClientPlayerSettings
}

export type PlayerAssetAssigned = {
    type: 'Player Asset Assigned'
    asset: LibraryAsset
}

export type PlayerAssetRemoved = {
    type: 'Player Asset Removed'
    assetId: string
}

export type PlayerCharacterAssigned = {
    type: 'Player Character Assigned'
    character: LibraryCharacter
}

export type PlayerCharacterRemoved = {
    type: 'Player Character Removed'
    characterId: string
}

export type PlayerEventUpdate =
    | PlayerSnapshot // Used when the entire snapshot is recomputed (e.g. cache miss)
    | PlayerSettingsUpdated
    | PlayerAssetAssigned
    | PlayerAssetRemoved
    | PlayerCharacterAssigned
    | PlayerCharacterRemoved

//
// External (EventBridge / Replay storage) payloads
// Internal and external formats are currently identical pass-throughs.
//

export type PlayerSnapshotExternal = PlayerSnapshot
export type PlayerExternal =
    | PlayerSnapshot
    | PlayerSettingsUpdated
    | PlayerAssetAssigned
    | PlayerAssetRemoved
    | PlayerCharacterAssigned
    | PlayerCharacterRemoved

export { PlayerAggregator } from './baseClasses'

//
// Runtime typeguards
//

const isLibraryAsset = (value: any): value is LibraryAsset => (
    value &&
    typeof value === 'object' &&
    typeof value.AssetId === 'string' &&
    (value.zone === undefined || (typeof value.zone === 'string' && isZone(value.zone))) &&
    (value.ShortName === undefined || typeof value.ShortName === 'string') &&
    (value.Summary === undefined || isRenderTree(value.Summary))
)

// NOTE: LibraryCharacter (and this guard) reflects the legacy pattern in which
// characters live in standalone files. The multi-draft migration keeps that old
// wire format for now; the player data source should translate whatever the cache
// currently stores, even though characters are moving toward component-in-asset
// representations. Future refactors can simplify this when the cache model changes.
const isLibraryCharacter = (value: any): value is LibraryCharacter => (
    value &&
    typeof value === 'object' &&
    typeof value.CharacterId === 'string' &&
    typeof value.DisplayName === 'string' &&
    (value.scopedId === undefined || typeof value.scopedId === 'string') &&
    (value.fileName === undefined || typeof value.fileName === 'string') &&
    (value.fileURL === undefined || typeof value.fileURL === 'string') &&
    (value.Pronouns === undefined || typeof value.Pronouns === 'string')
)

const isPlayerSettings = (value: any): value is AssetClientPlayerSettings => (
    value &&
    typeof value === 'object' &&
    Array.isArray(value.onboardCompleteTags) &&
    value.onboardCompleteTags.every((entry: any) => typeof entry === 'string') &&
    (value.guestName === undefined || typeof value.guestName === 'string') &&
    (value.guestId === undefined || typeof value.guestId === 'string')
)

export const isPlayerSnapshot = (value: any): value is PlayerSnapshot => (
    value &&
    typeof value === 'object' &&
    value.type === 'Snapshot' &&
    Array.isArray(value.assets) &&
    value.assets.every(isLibraryAsset) &&
    Array.isArray(value.characters) &&
    value.characters.every(isLibraryCharacter) &&
    isPlayerSettings(value.settings)
)

export const isPlayerSettingsUpdated = (value: any): value is PlayerSettingsUpdated => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Settings Updated' &&
    isPlayerSettings(value.settings)
)

export const isPlayerAssetAssigned = (value: any): value is PlayerAssetAssigned => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Asset Assigned' &&
    isLibraryAsset(value.asset)
)

export const isPlayerAssetRemoved = (value: any): value is PlayerAssetRemoved => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Asset Removed' &&
    typeof value.assetId === 'string'
)

export const isPlayerCharacterAssigned = (value: any): value is PlayerCharacterAssigned => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Character Assigned' &&
    isLibraryCharacter(value.character)
)

export const isPlayerCharacterRemoved = (value: any): value is PlayerCharacterRemoved => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Character Removed' &&
    typeof value.characterId === 'string'
)

export const isPlayerExternal = (value: any): value is PlayerExternal => (
    isPlayerSnapshot(value) ||
    isPlayerSettingsUpdated(value) ||
    isPlayerAssetAssigned(value) ||
    isPlayerAssetRemoved(value) ||
    isPlayerCharacterAssigned(value) ||
    isPlayerCharacterRemoved(value)
)

//
// Serialize/deserialize params - use ResolvedStreamingEnvelope so header discriminates content shape
//

type PlayerSerializeParams = ResolvedStreamingEnvelope<PlayerEventUpdate, StreamingEventHeader>
type PlayerDeserializeParams = ResolvedStreamingEnvelope<PlayerExternal, StreamingEventHeader>

// Envelope type guards for serialize (header.type narrows content)
const isPlayerSnapshotSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Snapshot' }; content: PlayerSnapshot } =>
    p.header.type === 'Snapshot'
const isPlayerSettingsUpdatedSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Player Settings Updated' }; content: PlayerSettingsUpdated } =>
    p.header.type === 'Player Settings Updated'
const isPlayerAssetAssignedSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Player Asset Assigned' }; content: PlayerAssetAssigned } =>
    p.header.type === 'Player Asset Assigned'
const isPlayerAssetRemovedSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Player Asset Removed' }; content: PlayerAssetRemoved } =>
    p.header.type === 'Player Asset Removed'
const isPlayerCharacterAssignedSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Player Character Assigned' }; content: PlayerCharacterAssigned } =>
    p.header.type === 'Player Character Assigned'
const isPlayerCharacterRemovedSerializeParams = (p: PlayerSerializeParams): p is PlayerSerializeParams & { header: StreamingEventHeader & { type: 'Player Character Removed' }; content: PlayerCharacterRemoved } =>
    p.header.type === 'Player Character Removed'

// Envelope type guards for deserialize (header.type narrows content)
const isPlayerSnapshotDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Snapshot' }; content: PlayerSnapshot } =>
    params.header.type === 'Snapshot'

const isPlayerSettingsUpdatedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Settings Updated' }; content: PlayerSettingsUpdated } =>
    params.header.type === 'Player Settings Updated'

const isPlayerAssetAssignedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Asset Assigned' }; content: PlayerAssetAssigned } =>
    params.header.type === 'Player Asset Assigned'

const isPlayerAssetRemovedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Asset Removed' }; content: PlayerAssetRemoved } =>
    params.header.type === 'Player Asset Removed'

const isPlayerCharacterAssignedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Character Assigned' }; content: PlayerCharacterAssigned } =>
    params.header.type === 'Player Character Assigned'

const isPlayerCharacterRemovedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Character Removed' }; content: PlayerCharacterRemoved } =>
    params.header.type === 'Player Character Removed'

//
// Serializer
//

export class PlayerEventSerializer implements DataSourceEventSerializer<
    PlayerEventUpdate,
    PlayerExternal,
    PlayerSnapshot,
    PlayerSnapshotExternal
> {
    serialize(params: PlayerSerializeParams): PlayerExternal {
        if (isPlayerSnapshotSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Snapshot',
                assets: content.assets.map((asset) => ({ ...asset })),
                characters: content.characters.map((character) => ({ ...character })),
                settings: { ...content.settings }
            }
        }
        if (isPlayerSettingsUpdatedSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Player Settings Updated',
                settings: { ...content.settings }
            }
        }
        if (isPlayerAssetAssignedSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Player Asset Assigned',
                asset: { ...content.asset }
            }
        }
        if (isPlayerAssetRemovedSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Player Asset Removed',
                assetId: content.assetId
            }
        }
        if (isPlayerCharacterAssignedSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Player Character Assigned',
                character: { ...content.character }
            }
        }
        if (isPlayerCharacterRemovedSerializeParams(params)) {
            const { content } = params
            return {
                type: 'Player Character Removed',
                characterId: content.characterId
            }
        }
        throw new Error(`Unknown player event type: ${params.header.type}`)
    }

    deserialize(params: PlayerDeserializeParams): PlayerEventUpdate | null {
        // Route on header.type only (envelope-authoritative); do not branch on content.type
        if (isPlayerSnapshotDeserializeParams(params)) {
            const c = params.content
            if (!Array.isArray(c.assets) || !Array.isArray(c.characters) || typeof c.settings !== 'object') {
                console.error('Invalid player snapshot payload', c)
                return null
            }
            return {
                type: 'Snapshot',
                assets: c.assets.map((asset) => ({ ...asset })),
                characters: c.characters.map((character) => ({ ...character })),
                settings: { ...c.settings }
            }
        }
        if (isPlayerSettingsUpdatedDeserializeParams(params)) {
            const c = params.content
            return { type: 'Player Settings Updated', settings: { ...c.settings } }
        }
        if (isPlayerAssetAssignedDeserializeParams(params)) {
            const c = params.content
            return { type: 'Player Asset Assigned', asset: { ...c.asset } }
        }
        if (isPlayerAssetRemovedDeserializeParams(params)) {
            const c = params.content
            return { type: 'Player Asset Removed', assetId: c.assetId }
        }
        if (isPlayerCharacterAssignedDeserializeParams(params)) {
            const c = params.content
            return { type: 'Player Character Assigned', character: { ...c.character } }
        }
        if (isPlayerCharacterRemovedDeserializeParams(params)) {
            const c = params.content
            return { type: 'Player Character Removed', characterId: c.characterId }
        }
        console.error('Unknown player event header type', params.header)
        return null
    }

    serializeSnapshot(snapshot: PlayerSnapshot): PlayerSnapshotExternal {
        if (!isPlayerSnapshot(snapshot)) {
            throw new Error(`Invalid player snapshot payload: ${JSON.stringify(snapshot)}`)
        }
        return {
            type: 'Snapshot',
            assets: snapshot.assets.map((asset) => ({ ...asset })),
            characters: snapshot.characters.map((character) => ({ ...character })),
            settings: { ...snapshot.settings }
        }
    }

    deserializeSnapshot(externalSnapshot: PlayerSnapshotExternal): PlayerSnapshot | null {
        if (!isPlayerSnapshot(externalSnapshot)) {
            console.error('Invalid player snapshot external payload', externalSnapshot)
            return null
        }
        return {
            type: 'Snapshot',
            assets: externalSnapshot.assets.map((asset) => ({ ...asset })),
            characters: externalSnapshot.characters.map((character) => ({ ...character })),
            settings: { ...externalSnapshot.settings }
        }
    }
}


