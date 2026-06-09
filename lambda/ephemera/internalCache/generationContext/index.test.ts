import internalCache from '..'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'
import { mergeRoomShortNameLiteral } from '../roomWireMergeHelpers'
import type { ComponentAcrossAssetsEntry } from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import type { StandardComponent } from '@tonylb/mtw-wml/ts/standardize/components/baseClasses'

const componentEntry = (component: StandardComponent): ComponentAcrossAssetsEntry => ({ component })

describe('GenerationContext cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('derives room shortName context from ComponentData', async () => {
        jest.spyOn(internalCache.ComponentData, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': componentEntry(new StandardRoom({
                universalKey: 'ROOM#TestRoom',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [],
            })),
        })

        const result = await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])

        expect(result?.componentId).toEqual('ROOM#TestRoom')
        expect(result?.shortName.toJSON()).toEqual('Test Room')
    })

    it('returns undefined when shortName cannot be derived', async () => {
        jest.spyOn(internalCache.ComponentData, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': componentEntry(new StandardFeature({
                universalKey: 'FEATURE#TestFeature',
                tag: 'Feature',
            })),
        })

        await expect(
            internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        ).resolves.toBeUndefined()
    })

    it('merges shortName literals in assetStack order', async () => {
        const baseRoom = new StandardRoom({
            universalKey: 'ROOM#TestRoom',
            tag: 'Room',
            shortName: 'Base Room',
            exits: [],
        })
        const overrideRoom = new StandardRoom({
            universalKey: 'ROOM#TestRoom',
            tag: 'Room',
            shortName: 'Override Room',
            exits: [],
        })
        jest.spyOn(internalCache.ComponentData, 'getAcrossAssets').mockResolvedValue({
            // Intentionally reverse insertion order to ensure merge logic follows assetStack, not object values
            'ASSET#Override': componentEntry(overrideRoom),
            'ASSET#Base': componentEntry(baseRoom),
        })

        const assetStack = ['ASSET#Base', 'ASSET#Override'] as const
        const result = await internalCache.GenerationContext.get('ROOM#TestRoom', [...assetStack])
        const expected = mergeRoomShortNameLiteral([baseRoom, overrideRoom])

        expect(result?.shortName.toJSON()).toEqual(expected?.toJSON())
    })

    it('clears cached entries through InternalCache.clear lifecycle', async () => {
        const getAcrossAssetsSpy = jest.spyOn(internalCache.ComponentData, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': componentEntry(new StandardRoom({
                universalKey: 'ROOM#TestRoom',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [],
            })),
        })

        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        expect(getAcrossAssetsSpy).toHaveBeenCalledTimes(1)

        internalCache.clear()

        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        expect(getAcrossAssetsSpy).toHaveBeenCalledTimes(2)
    })
})
