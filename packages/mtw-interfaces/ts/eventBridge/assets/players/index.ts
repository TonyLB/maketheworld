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

export type PlayerLibraryUpdated = {
    type: 'Player Library Updated'
    assets: LibraryAsset[]
    characters: LibraryCharacter[]
    settings: AssetClientPlayerSettings
}

export type PlayerEventUpdate = PlayerLibraryUpdated

//
// External (EventBridge / Replay storage) payloads
// Internal and external formats are currently identical pass-throughs.
//

export type PlayerSnapshotExternal = PlayerSnapshot
export type PlayerLibraryUpdatedExternal = PlayerLibraryUpdated
export type PlayerExternal = PlayerLibraryUpdatedExternal

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
    (value.fileName === undefined || typeof value.fileName === 'string')
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

export const isPlayerLibraryUpdated = (value: any): value is PlayerLibraryUpdated => (
    value &&
    typeof value === 'object' &&
    value.type === 'Player Library Updated' &&
    Array.isArray(value.assets) &&
    value.assets.every(isLibraryAsset) &&
    Array.isArray(value.characters) &&
    value.characters.every(isLibraryCharacter) &&
    isPlayerSettings(value.settings)
)

export const isPlayerExternal = (value: any): value is PlayerExternal => (
    isPlayerLibraryUpdated(value)
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
        if (!isPlayerLibraryUpdated(update)) {
            throw new Error(`Unknown player event update: ${JSON.stringify(update)}`)
        }
        return {
            type: 'Player Library Updated',
            assets: update.assets.map((asset) => ({ ...asset })),
            characters: update.characters.map((character) => ({ ...character })),
            settings: { ...update.settings }
        }
    }

    deserialize(params: {
        dataSourceKey: string
        streamKey: string
        externalUpdate: PlayerExternal
    }): PlayerEventUpdate | null {
        const { externalUpdate } = params
        if (!isPlayerLibraryUpdated(externalUpdate)) {
            console.error('Invalid player external update payload', externalUpdate)
            return null
        }
        return {
            type: 'Player Library Updated',
            assets: externalUpdate.assets.map((asset) => ({ ...asset })),
            characters: externalUpdate.characters.map((character) => ({ ...character })),
            settings: { ...externalUpdate.settings }
        }
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


