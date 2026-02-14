import { AggregationResult, DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerSnapshot,
    PlayerEventUpdate,
    isPlayerSnapshot,
    isPlayerSettingsUpdated,
    isPlayerAssetAssigned,
    isPlayerAssetRemoved,
    isPlayerCharacterAssigned,
    isPlayerCharacterRemoved
} from '.'

type PlayerSnapshotInternal = PlayerSnapshot

export class PlayerAggregator implements DataSourceAggregator<PlayerSnapshotInternal, PlayerEventUpdate> {
    createEmpty(): PlayerSnapshotInternal {
        return {
            type: 'Snapshot',
            assets: [],
            characters: [],
            settings: {
                onboardCompleteTags: []
            }
        }
    }

    applyUpdate(snapshot: PlayerSnapshotInternal, update: PlayerEventUpdate, _header: StreamingEventHeader): AggregationResult<PlayerSnapshotInternal> {
        if (isPlayerSnapshot(update)) {
            return {
                success: true,
                snapshot: {
                    type: 'Snapshot',
                    assets: update.assets.map((asset) => ({ ...asset })),
                    characters: update.characters.map((character) => ({ ...character })),
                    settings: { ...update.settings }
                }
            }
        }

        const next: PlayerSnapshotInternal = {
            type: 'Snapshot',
            assets: snapshot.assets.map((asset) => ({ ...asset })),
            characters: snapshot.characters.map((character) => ({ ...character })),
            settings: { ...snapshot.settings }
        }

        if (isPlayerSettingsUpdated(update)) {
            next.settings = { ...update.settings }
            return { success: true, snapshot: next }
        }

        if (isPlayerAssetAssigned(update)) {
            const updatedAsset = { ...update.asset }
            next.assets = [
                ...next.assets.filter(({ AssetId }) => AssetId !== updatedAsset.AssetId),
                updatedAsset
            ]
            return { success: true, snapshot: next }
        }

        if (isPlayerAssetRemoved(update)) {
            next.assets = next.assets.filter(({ AssetId }) => AssetId !== update.assetId)
            return { success: true, snapshot: next }
        }

        if (isPlayerCharacterAssigned(update)) {
            const updatedCharacter = { ...update.character }
            next.characters = [
                ...next.characters.filter(({ CharacterId }) => CharacterId !== updatedCharacter.CharacterId),
                updatedCharacter
            ]
            return { success: true, snapshot: next }
        }

        if (isPlayerCharacterRemoved(update)) {
            next.characters = next.characters.filter(({ CharacterId }) => CharacterId !== update.characterId)
            return { success: true, snapshot: next }
        }

        return {
            success: false,
            error: new Error(`Unknown player update: ${JSON.stringify(update)}`),
            snapshot
        }
    }
}


