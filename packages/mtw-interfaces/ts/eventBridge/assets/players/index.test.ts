import { PlayerSnapshot, PlayerAssetAssigned, PlayerAssetRemoved, PlayerSettingsUpdated } from '.'
import { PlayerAggregator } from './baseClasses'

describe('PlayerAggregator', () => {
    const createSnapshot = (): PlayerSnapshot => ({
        type: 'Snapshot',
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
            type: 'Snapshot',
            assets: [{ AssetId: 'AssetOne', zone: 'Draft' }],
            characters: [{ CharacterId: 'CHARACTER#test', DisplayName: 'Test Character', scopedId: 'test', fileName: 'test' }],
            settings: { onboardCompleteTags: ['basic'] }
        }

        const result = aggregator.applyUpdate(snapshot, replacement)
        expect(result.success).toBe(true)
        expect(result.snapshot.assets[0].AssetId).toBe('AssetOne')
        expect(result.snapshot.characters[0].CharacterId).toBe('CHARACTER#test')
        expect(result.snapshot.settings.onboardCompleteTags).toEqual(['basic'])
    })

    it('updates settings', () => {
        const aggregator = new PlayerAggregator()
        const snapshot = createSnapshot()
        const update: PlayerSettingsUpdated = {
            type: 'Player Settings Updated',
            settings: { onboardCompleteTags: ['chapter1'], guestName: 'Guest', guestId: 'guest-123' }
        }

        const result = aggregator.applyUpdate(snapshot, update)
        expect(result.success).toBe(true)
        expect(result.snapshot.settings).toEqual(update.settings)
    })

    it('assigns and removes assets', () => {
        const aggregator = new PlayerAggregator()
        const snapshot = createSnapshot()

        const assign: PlayerAssetAssigned = {
            type: 'Player Asset Assigned',
            asset: { AssetId: 'AssetOne', zone: 'Draft' }
        }
        const assignResult = aggregator.applyUpdate(snapshot, assign)
        expect(assignResult.success).toBe(true)
        expect(assignResult.snapshot.assets).toHaveLength(1)
        expect(assignResult.snapshot.assets[0]).toEqual(assign.asset)

        const remove: PlayerAssetRemoved = {
            type: 'Player Asset Removed',
            assetId: 'AssetOne'
        }
        const removeResult = aggregator.applyUpdate(assignResult.snapshot, remove)
        expect(removeResult.success).toBe(true)
        expect(removeResult.snapshot.assets).toHaveLength(0)
    })
})

