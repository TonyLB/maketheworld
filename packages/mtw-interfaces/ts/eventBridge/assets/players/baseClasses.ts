import { AggregationResult, DataSourceAggregator } from '@tonylb/mtw-lambda-patterns/ts/dataSource/aggregation'
import type { ResolvedStreamingEnvelope, StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'
import {
    PlayerSnapshot,
    PlayerEventUpdate,
    PlayerSettingsUpdated,
    PlayerAssetAssigned,
    PlayerAssetRemoved,
    PlayerCharacterAssigned,
    PlayerCharacterRemoved
} from '.'

type PlayerSnapshotInternal = PlayerSnapshot

// Envelope type guards: narrow both header and content so aggregator needs no casts
export type PlayerEnvelope = ResolvedStreamingEnvelope<PlayerEventUpdate, StreamingEventHeader>

export function isPlayerSnapshotEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerSnapshot, StreamingEventHeader & { type: 'Snapshot' }> {
    return envelope.header.type === 'Snapshot'
}

export function isPlayerSettingsUpdatedEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerSettingsUpdated, StreamingEventHeader & { type: 'Player Settings Updated' }> {
    return envelope.header.type === 'Player Settings Updated'
}

export function isPlayerAssetAssignedEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerAssetAssigned, StreamingEventHeader & { type: 'Player Asset Assigned' }> {
    return envelope.header.type === 'Player Asset Assigned'
}

export function isPlayerAssetRemovedEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerAssetRemoved, StreamingEventHeader & { type: 'Player Asset Removed' }> {
    return envelope.header.type === 'Player Asset Removed'
}

export function isPlayerCharacterAssignedEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerCharacterAssigned, StreamingEventHeader & { type: 'Player Character Assigned' }> {
    return envelope.header.type === 'Player Character Assigned'
}

export function isPlayerCharacterRemovedEnvelope(
    envelope: PlayerEnvelope
): envelope is ResolvedStreamingEnvelope<PlayerCharacterRemoved, StreamingEventHeader & { type: 'Player Character Removed' }> {
    return envelope.header.type === 'Player Character Removed'
}

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

    applyUpdate(snapshot: PlayerSnapshotInternal, envelope: PlayerEnvelope): AggregationResult<PlayerSnapshotInternal> {
        if (isPlayerSnapshotEnvelope(envelope)) {
            const { assets, characters, settings } = envelope.content
            return {
                success: true,
                snapshot: {
                    type: 'Snapshot',
                    assets: assets.map((asset) => ({ ...asset })),
                    characters: characters.map((character) => ({ ...character })),
                    settings: { ...settings }
                }
            }
        }

        const next: PlayerSnapshotInternal = {
            type: 'Snapshot',
            assets: snapshot.assets.map((asset) => ({ ...asset })),
            characters: snapshot.characters.map((character) => ({ ...character })),
            settings: { ...snapshot.settings }
        }

        if (isPlayerSettingsUpdatedEnvelope(envelope)) {
            next.settings = { ...envelope.content.settings }
            return { success: true, snapshot: next }
        }

        if (isPlayerAssetAssignedEnvelope(envelope)) {
            const updatedAsset = { ...envelope.content.asset }
            next.assets = [
                ...next.assets.filter(({ AssetId }) => AssetId !== updatedAsset.AssetId),
                updatedAsset
            ]
            return { success: true, snapshot: next }
        }

        if (isPlayerAssetRemovedEnvelope(envelope)) {
            next.assets = next.assets.filter(({ AssetId }) => AssetId !== envelope.content.assetId)
            return { success: true, snapshot: next }
        }

        if (isPlayerCharacterAssignedEnvelope(envelope)) {
            const updatedCharacter = { ...envelope.content.character }
            next.characters = [
                ...next.characters.filter(({ CharacterId }) => CharacterId !== updatedCharacter.CharacterId),
                updatedCharacter
            ]
            return { success: true, snapshot: next }
        }

        if (isPlayerCharacterRemovedEnvelope(envelope)) {
            next.characters = next.characters.filter(({ CharacterId }) => CharacterId !== envelope.content.characterId)
            return { success: true, snapshot: next }
        }

        return {
            success: false,
            error: new Error(`Unknown player update: ${envelope.header.type}`),
            snapshot
        }
    }
}


