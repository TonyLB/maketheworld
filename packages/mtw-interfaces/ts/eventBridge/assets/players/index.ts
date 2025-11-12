// Player Data Source Event Contracts
//
// This file defines the EventBridge contracts for the planned mtw.assets.players
// data source. The data source will provide replayable player-centric snapshots
// and streaming updates that keep the client synchronized with a player's
// currently accessible assets, characters, and related library state.

import { DataSourceEventSerializer } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
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

export type PlayerSnapshotGenerated = {
    type: 'Snapshot Generated'
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

export type PlayerSnapshotExternal = PlayerSnapshot | PlayerSnapshotGenerated
export type PlayerExternal =
    | PlayerSnapshot
    | PlayerSnapshotGenerated
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
    typeof value.Name === 'string' &&
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

const isPlayerSnapshotGenerated = (value: any): value is PlayerSnapshotGenerated => (
    value &&
    typeof value === 'object' &&
    value.type === 'Snapshot Generated' &&
    Array.isArray(value.assets) &&
    value.assets.every(isLibraryAsset) &&
    Array.isArray(value.characters) &&
    value.characters.every(isLibraryCharacter) &&
    isPlayerSettings(value.settings)
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
    isPlayerSnapshotGenerated(value) ||
    isPlayerSettingsUpdated(value) ||
    isPlayerAssetAssigned(value) ||
    isPlayerAssetRemoved(value) ||
    isPlayerCharacterAssigned(value) ||
    isPlayerCharacterRemoved(value)
)

//
// Serializer
//

export class PlayerEventSerializer implements DataSourceEventSerializer<
    PlayerEventUpdate,
    PlayerExternal,
    PlayerSnapshot,
    PlayerSnapshotExternal
> {
    serialize(params: {
        dataSourceKey: string
        streamKey: string
        update: PlayerEventUpdate
    }): PlayerExternal {
        const { update } = params
        if (isPlayerSnapshot(update)) {
            return {
                type: 'Snapshot',
                assets: update.assets.map((asset) => ({ ...asset })),
                characters: update.characters.map((character) => ({ ...character })),
                settings: { ...update.settings }
            }
        }
        if (isPlayerSettingsUpdated(update)) {
            return {
                type: 'Player Settings Updated',
                settings: { ...update.settings }
            }
        }
        if (isPlayerAssetAssigned(update)) {
            return {
                type: 'Player Asset Assigned',
                asset: { ...update.asset }
            }
        }
        if (isPlayerAssetRemoved(update)) {
            return {
                type: 'Player Asset Removed',
                assetId: update.assetId
            }
        }
        if (isPlayerCharacterAssigned(update)) {
            return {
                type: 'Player Character Assigned',
                character: { ...update.character }
            }
        }
        if (isPlayerCharacterRemoved(update)) {
            return {
                type: 'Player Character Removed',
                characterId: update.characterId
            }
        }
        throw new Error(`Unknown player event update: ${JSON.stringify(update)}`)
    }

    deserialize(params: {
        dataSourceKey: string
        streamKey: string
        externalUpdate: PlayerExternal
    }): PlayerEventUpdate | null {
        const { externalUpdate } = params
        if (isPlayerSnapshot(externalUpdate) || isPlayerSnapshotGenerated(externalUpdate)) {
            return {
                type: 'Snapshot',
                assets: externalUpdate.assets.map((asset) => ({ ...asset })),
                characters: externalUpdate.characters.map((character) => ({ ...character })),
                settings: { ...externalUpdate.settings }
            }
        }
        if (isPlayerSettingsUpdated(externalUpdate)) {
            return {
                type: 'Player Settings Updated',
                settings: { ...externalUpdate.settings }
            }
        }
        if (isPlayerAssetAssigned(externalUpdate)) {
            return {
                type: 'Player Asset Assigned',
                asset: { ...externalUpdate.asset }
            }
        }
        if (isPlayerAssetRemoved(externalUpdate)) {
            return {
                type: 'Player Asset Removed',
                assetId: externalUpdate.assetId
            }
        }
        if (isPlayerCharacterAssigned(externalUpdate)) {
            return {
                type: 'Player Character Assigned',
                character: { ...externalUpdate.character }
            }
        }
        if (isPlayerCharacterRemoved(externalUpdate)) {
            return {
                type: 'Player Character Removed',
                characterId: externalUpdate.characterId
            }
        }
        console.error('Invalid player external update payload', externalUpdate)
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
        // Accept both 'Snapshot' and 'Snapshot Generated' types
        if (!isPlayerSnapshot(externalSnapshot) && !isPlayerSnapshotGenerated(externalSnapshot)) {
            console.error('Invalid player snapshot external payload', externalSnapshot)
            return null
        }
        // Convert to internal 'Snapshot' format (normalize 'Snapshot Generated' to 'Snapshot')
        return {
            type: 'Snapshot',
            assets: externalSnapshot.assets.map((asset) => ({ ...asset })),
            characters: externalSnapshot.characters.map((character) => ({ ...character })),
            settings: { ...externalSnapshot.settings }
        }
    }
}


