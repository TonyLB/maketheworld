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
// Player snapshot and streaming event payloads (internal: no type; discrimination by header)
//

export type PlayerSnapshot = {
    assets: LibraryAsset[]
    characters: LibraryCharacter[]
    settings: AssetClientPlayerSettings
}

export type PlayerSettingsUpdated = {
    settings: AssetClientPlayerSettings
}

export type PlayerAssetAssigned = {
    asset: LibraryAsset
}

export type PlayerAssetRemoved = {
    assetId: string
}

export type PlayerCharacterAssigned = {
    character: LibraryCharacter
}

export type PlayerCharacterRemoved = {
    characterId: string
}

export type PlayerEventUpdate =
    | PlayerSnapshot
    | PlayerSettingsUpdated
    | PlayerAssetAssigned
    | PlayerAssetRemoved
    | PlayerCharacterAssigned
    | PlayerCharacterRemoved

//
// External (EventBridge / Replay storage) payloads - include type for wire
//

export type PlayerSnapshotExternal = { assets: LibraryAsset[]; characters: LibraryCharacter[]; settings: AssetClientPlayerSettings }
export type PlayerSettingsUpdatedExternal = { settings: AssetClientPlayerSettings }
export type PlayerAssetAssignedExternal = { asset: LibraryAsset }
export type PlayerAssetRemovedExternal = { assetId: string }
export type PlayerCharacterAssignedExternal = { character: LibraryCharacter }
export type PlayerCharacterRemovedExternal = { characterId: string }

export type PlayerExternal =
    | PlayerSnapshotExternal
    | PlayerSettingsUpdatedExternal
    | PlayerAssetAssignedExternal
    | PlayerAssetRemovedExternal
    | PlayerCharacterAssignedExternal
    | PlayerCharacterRemovedExternal

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
    Array.isArray(value.assets) &&
    value.assets.every(isLibraryAsset) &&
    Array.isArray(value.characters) &&
    value.characters.every(isLibraryCharacter) &&
    isPlayerSettings(value.settings)
)

export const isPlayerSettingsUpdated = (value: any): value is PlayerSettingsUpdated => (
    value &&
    typeof value === 'object' &&
    'settings' in value &&
    isPlayerSettings(value.settings) &&
    !('asset' in value) &&
    !('assets' in value)
)

export const isPlayerAssetAssigned = (value: any): value is PlayerAssetAssigned => (
    value &&
    typeof value === 'object' &&
    'asset' in value &&
    isLibraryAsset(value.asset)
)

export const isPlayerAssetRemoved = (value: any): value is PlayerAssetRemoved => (
    value &&
    typeof value === 'object' &&
    typeof value.assetId === 'string' &&
    !('asset' in value)
)

export const isPlayerCharacterAssigned = (value: any): value is PlayerCharacterAssigned => (
    value &&
    typeof value === 'object' &&
    'character' in value &&
    isLibraryCharacter(value.character)
)

export const isPlayerCharacterRemoved = (value: any): value is PlayerCharacterRemoved => (
    value &&
    typeof value === 'object' &&
    typeof value.characterId === 'string' &&
    !('character' in value)
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

// Envelope type guards for deserialize (header.type narrows content; content is external with type)
const isPlayerSnapshotDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Snapshot' }; content: PlayerSnapshotExternal } =>
    params.header.type === 'Snapshot'

const isPlayerSettingsUpdatedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Settings Updated' }; content: PlayerSettingsUpdatedExternal } =>
    params.header.type === 'Player Settings Updated'

const isPlayerAssetAssignedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Asset Assigned' }; content: PlayerAssetAssignedExternal } =>
    params.header.type === 'Player Asset Assigned'

const isPlayerAssetRemovedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Asset Removed' }; content: PlayerAssetRemovedExternal } =>
    params.header.type === 'Player Asset Removed'

const isPlayerCharacterAssignedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Character Assigned' }; content: PlayerCharacterAssignedExternal } =>
    params.header.type === 'Player Character Assigned'

const isPlayerCharacterRemovedDeserializeParams = (params: PlayerDeserializeParams): params is PlayerDeserializeParams & { header: StreamingEventHeader & { type: 'Player Character Removed' }; content: PlayerCharacterRemovedExternal } =>
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
            const snapshot = params.content
            if (!isPlayerSnapshot(snapshot)) {
                throw new Error(`Invalid player snapshot payload: ${JSON.stringify(snapshot)}`)
            }
            return {
                assets: snapshot.assets.map((asset) => ({ ...asset })),
                characters: snapshot.characters.map((character) => ({ ...character })),
                settings: { ...snapshot.settings }
            }
        }
        if (isPlayerSettingsUpdatedSerializeParams(params)) {
            const { content } = params
            return {
                settings: { ...content.settings }
            }
        }
        if (isPlayerAssetAssignedSerializeParams(params)) {
            const { content } = params
            return {
                asset: { ...content.asset }
            }
        }
        if (isPlayerAssetRemovedSerializeParams(params)) {
            const { content } = params
            return {
                assetId: content.assetId
            }
        }
        if (isPlayerCharacterAssignedSerializeParams(params)) {
            const { content } = params
            return {
                character: { ...content.character }
            }
        }
        if (isPlayerCharacterRemovedSerializeParams(params)) {
            const { content } = params
            return {
                characterId: content.characterId
            }
        }
        throw new Error(`Unknown player event type: ${params.header.type}`)
    }

    async deserialize(params: PlayerDeserializeParams): Promise<PlayerEventUpdate | null> {
        // Route on header.type only (envelope-authoritative); return internal content without type
        if (isPlayerSnapshotDeserializeParams(params)) {
            const externalSnapshot = params.content
            if (!isPlayerSnapshot(externalSnapshot)) {
                console.error('Invalid player snapshot external payload', externalSnapshot)
                return null
            }
            return {
                assets: externalSnapshot.assets.map((asset) => ({ ...asset })),
                characters: externalSnapshot.characters.map((character) => ({ ...character })),
                settings: { ...externalSnapshot.settings }
            }
        }
        if (isPlayerSettingsUpdatedDeserializeParams(params)) {
            const c = params.content
            return { settings: { ...c.settings } }
        }
        if (isPlayerAssetAssignedDeserializeParams(params)) {
            const c = params.content
            return { asset: { ...c.asset } }
        }
        if (isPlayerAssetRemovedDeserializeParams(params)) {
            const c = params.content
            return { assetId: c.assetId }
        }
        if (isPlayerCharacterAssignedDeserializeParams(params)) {
            const c = params.content
            return { character: { ...c.character } }
        }
        if (isPlayerCharacterRemovedDeserializeParams(params)) {
            const c = params.content
            return { characterId: c.characterId }
        }
        console.error('Unknown player event header type', params.header)
        return null
    }
}


