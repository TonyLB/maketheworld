import { PlayerSnapshot, PlayerAssetAssigned, PlayerAssetRemoved, PlayerSettingsUpdated, PlayerEventSerializer, PlayerSnapshotExternal } from '.'
import { PlayerAggregator } from './baseClasses'
import type { StreamingEventHeader } from '@tonylb/mtw-lambda-patterns/ts/dataSource/baseClasses'

function playersHeader(type: string): StreamingEventHeader {
    return { dataSourceKey: 'mtw.assets.players', streamKey: 'test', timestamp: 0, type }
}

function playersEnvelope<T>(content: T, type: string) {
    return { header: playersHeader(type), content }
}

describe('PlayerAggregator', () => {
    const createSnapshot = (): PlayerSnapshot => ({
        assets: [],
        characters: [],
        settings: {
            onboardCompleteTags: []
        }
    })

    it('applies snapshot replacement', () => {
        const aggregator = new PlayerAggregator()
        const snapshot = createSnapshot()
        const replacement: PlayerSnapshot = {
            assets: [{ AssetId: 'AssetOne', zone: 'Draft' }],
            characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test Character', scopedId: 'test', fileName: 'test' }],
            settings: { onboardCompleteTags: ['basic'] }
        }

        const result = aggregator.applyUpdate(snapshot, playersEnvelope(replacement, 'Snapshot'))
        expect(result.success).toBe(true)
        expect(result.snapshot.assets[0].AssetId).toBe('AssetOne')
        expect(result.snapshot.characters[0].CharacterId).toBe('CHARACTER#test')
        expect(result.snapshot.settings.onboardCompleteTags).toEqual(['basic'])
    })

    it('updates settings', () => {
        const aggregator = new PlayerAggregator()
        const snapshot = createSnapshot()
        const update: PlayerSettingsUpdated = {
            settings: { onboardCompleteTags: ['chapter1'], guestName: 'Guest', guestId: 'guest-123' }
        }

        const result = aggregator.applyUpdate(snapshot, playersEnvelope(update, 'Player Settings Updated'))
        expect(result.success).toBe(true)
        expect(result.snapshot.settings).toEqual(update.settings)
    })

    it('assigns and removes assets', () => {
        const aggregator = new PlayerAggregator()
        const snapshot = createSnapshot()

        const assign: PlayerAssetAssigned = {
            asset: { AssetId: 'AssetOne', zone: 'Draft' }
        }
        const assignResult = aggregator.applyUpdate(snapshot, playersEnvelope(assign, 'Player Asset Assigned'))
        expect(assignResult.success).toBe(true)
        expect(assignResult.snapshot.assets).toHaveLength(1)
        expect(assignResult.snapshot.assets[0]).toEqual(assign.asset)

        const remove: PlayerAssetRemoved = {
            assetId: 'AssetOne'
        }
        const removeResult = aggregator.applyUpdate(assignResult.snapshot, playersEnvelope(remove, 'Player Asset Removed'))
        expect(removeResult.success).toBe(true)
        expect(removeResult.snapshot.assets).toHaveLength(0)
    })
})

describe('PlayerEventSerializer', () => {
    const serializer = new PlayerEventSerializer()

    describe('serialize/deserialize handle Snapshot when header.type is Snapshot', () => {
        it('should serialize Snapshot via main serialize when header.type is Snapshot', () => {
            const snapshot: PlayerSnapshot = {
                assets: [{ AssetId: 'AssetOne', zone: 'Draft' }],
                characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test', scopedId: 'test', fileName: 'test' }],
                settings: { onboardCompleteTags: [] }
            }
            const header = { dataSourceKey: 'mtw.assets.players', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }
            const result = serializer.serialize({ content: snapshot, header })
            expect(result).toEqual({
                assets: [{ AssetId: 'AssetOne', zone: 'Draft' }],
                characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test', scopedId: 'test', fileName: 'test' }],
                settings: { onboardCompleteTags: [] }
            })
        })

        it('should deserialize Snapshot via main deserialize when header.type is Snapshot', async () => {
            const externalSnapshot: PlayerSnapshotExternal = {
                assets: [{ AssetId: 'AssetOne', zone: 'Draft' as const }],
                characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test', scopedId: 'test', fileName: 'test' }],
                settings: { onboardCompleteTags: [] }
            }
            const header = { dataSourceKey: 'mtw.assets.players', streamKey: 'test', timestamp: 0, type: 'Snapshot' as const }
            const result = await serializer.deserialize({ content: externalSnapshot, header })
            expect(result).toEqual({
                assets: [{ AssetId: 'AssetOne', zone: 'Draft' }],
                characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test', scopedId: 'test', fileName: 'test' }],
                settings: { onboardCompleteTags: [] }
            })
        })
    })

    describe('deserialize when header and payload type disagree - header wins', () => {
        it('should deserialize as Player Asset Removed when header says Player Asset Removed but content has Asset Assigned shape', async () => {
            const content = {
                asset: { AssetId: 'AssetOne', zone: 'Draft' as const }
            }
            const header: StreamingEventHeader = {
                dataSourceKey: 'mtw.assets.players',
                streamKey: 'test',
                timestamp: 0,
                type: 'Player Asset Removed'
            }
            const result = await serializer.deserialize({ content: content as any, header })
            expect(result).not.toBeNull()
            expect(result && 'assetId' in result).toBe(true)
            expect((result as any).assetId).toBeUndefined()
        })
    })
})

