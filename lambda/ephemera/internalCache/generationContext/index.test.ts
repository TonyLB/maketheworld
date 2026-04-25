import internalCache from '..'
import StandardRoom from '@tonylb/mtw-wml/ts/standardize/components/room'
import StandardFeature from '@tonylb/mtw-wml/ts/standardize/components/feature'

describe('GenerationContext cache handler', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('derives room shortName context from ComponentAssetMeta', async () => {
        jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': new StandardRoom({
                universalKey: 'ROOM#TestRoom',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [],
            }),
        })

        const result = await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])

        expect(result?.componentId).toEqual('ROOM#TestRoom')
        expect(result?.shortName.toJSON()).toEqual('Test Room')
    })

    it('returns undefined when shortName cannot be derived', async () => {
        jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': new StandardFeature({
                universalKey: 'FEATURE#TestFeature',
                tag: 'Feature',
            }),
        })

        await expect(
            internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        ).resolves.toBeUndefined()
    })

    it('clears cached entries through InternalCache.clear lifecycle', async () => {
        const getAcrossAssetsSpy = jest.spyOn(internalCache.ComponentAssetMeta, 'getAcrossAssets').mockResolvedValue({
            'ASSET#Base': new StandardRoom({
                universalKey: 'ROOM#TestRoom',
                tag: 'Room',
                shortName: 'Test Room',
                exits: [],
            }),
        })

        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        expect(getAcrossAssetsSpy).toHaveBeenCalledTimes(1)

        internalCache.clear()

        await internalCache.GenerationContext.get('ROOM#TestRoom', ['ASSET#Base'])
        expect(getAcrossAssetsSpy).toHaveBeenCalledTimes(2)
    })
})
