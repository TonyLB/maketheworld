jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
import { assetDB } from '@tonylb/mtw-utilities/ts/dynamoDB'

import internalCache from '.'

const assetDBMock = jest.mocked(assetDB)

describe('internalCache.ComponentVerticals', () => {
    beforeEach(() => {
        internalCache.clear()
        jest.clearAllMocks()
    })

    it('returns default empty hops when no Meta::Import rows', async () => {
        assetDBMock.query.mockResolvedValue([] as any)
        const id = 'FEATURE#TestOne' as const
        const [result] = await internalCache.ComponentVerticals.get([id])
        expect(result).toEqual({ universalKey: id, hops: [] })
        expect(assetDBMock.query).toHaveBeenCalledTimes(1)
    })

    it('maps Meta::Import query rows to ImportVerticalHop list', async () => {
        assetDBMock.query.mockResolvedValue([
            {
                AssetId: 'FEATURE#TestOne',
                DataCategory: 'Meta::Import::parentA::childB',
            },
        ] as any)
        const id = 'FEATURE#TestOne' as const
        const [result] = await internalCache.ComponentVerticals.get([id])
        expect(result.universalKey).toBe(id)
        expect(result.hops).toHaveLength(1)
        expect(result.hops[0]).toMatchObject({
            dataCategory: 'Meta::Import::parentA::childB',
            parentStripped: 'parentA',
            childStripped: 'childB',
            parentAssetId: 'ASSET#parentA',
            childAssetId: 'ASSET#childB',
        })
    })

    it('second get re-queries after invalidate', async () => {
        assetDBMock.query.mockResolvedValue([] as any)
        const id = 'KNOWLEDGE#K1' as const
        await internalCache.ComponentVerticals.get([id])
        expect(assetDBMock.query).toHaveBeenCalledTimes(1)
        internalCache.ComponentVerticals.invalidate(id)
        await internalCache.ComponentVerticals.get([id])
        expect(assetDBMock.query).toHaveBeenCalledTimes(2)
    })
})
