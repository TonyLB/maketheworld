import { authoritativeFromParticipationOrder } from '@tonylb/mtw-gateways/ts/assets/components/componentData'
import internalCache from '../internalCache'
import {
    deriveMirroringParticipationOrder,
    loadAuthoritativeBatchForMirroring,
    loadAuthoritativeForMirroring,
} from './loadAuthoritativeForMirroring'

jest.mock('../internalCache', () => ({
    ComponentData: {},
    ComponentVerticals: { get: jest.fn() },
}))

jest.mock('@tonylb/mtw-gateways/ts/assets/components/componentData', () => {
    const actual = jest.requireActual('@tonylb/mtw-gateways/ts/assets/components/componentData')
    return {
        ...actual,
        authoritativeFromParticipationOrder: jest.fn(),
    }
})

const mockAuthoritativeFromParticipationOrder = jest.mocked(authoritativeFromParticipationOrder)

describe('loadAuthoritativeForMirroring', () => {
    const mockInternalCache = internalCache as unknown as {
        ComponentVerticals: { get: jest.Mock };
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('calls authoritativeFromParticipationOrder with explicit mergeParticipationOrder', async () => {
        const order = ['ASSET#a', 'ASSET#b'] as const
        const expected = { ComponentId: 'ROOM#r1', byAssets: [] }
        mockAuthoritativeFromParticipationOrder.mockResolvedValue(expected as never)

        const result = await loadAuthoritativeForMirroring('ROOM#r1', 'ASSET#b', order)

        expect(mockInternalCache.ComponentVerticals.get).not.toHaveBeenCalled()
        expect(mockAuthoritativeFromParticipationOrder).toHaveBeenCalledWith(
            'ROOM#r1',
            order,
            internalCache.ComponentData
        )
        expect(result).toBe(expected)
    })

    it('derives participation order from ComponentVerticals when order omitted', async () => {
        mockInternalCache.ComponentVerticals.get.mockResolvedValue([
            {
                hops: [
                    { parentAssetId: 'ASSET#parent', childAssetId: 'ASSET#child' },
                ],
            },
        ])
        mockAuthoritativeFromParticipationOrder.mockResolvedValue({
            ComponentId: 'ROOM#r1',
            byAssets: [],
        } as never)

        await loadAuthoritativeForMirroring('ROOM#r1', 'ASSET#event')

        expect(mockInternalCache.ComponentVerticals.get).toHaveBeenCalledWith(['ROOM#r1'])
        expect(mockAuthoritativeFromParticipationOrder).toHaveBeenCalledWith(
            'ROOM#r1',
            ['ASSET#child', 'ASSET#event', 'ASSET#parent'],
            internalCache.ComponentData
        )
    })

    it('returns empty byAssets when explicit mergeParticipationOrder is empty', async () => {
        const result = await loadAuthoritativeForMirroring('ROOM#r1', 'ASSET#event', [])

        expect(mockInternalCache.ComponentVerticals.get).not.toHaveBeenCalled()
        expect(mockAuthoritativeFromParticipationOrder).not.toHaveBeenCalled()
        expect(result).toEqual({ ComponentId: 'ROOM#r1', byAssets: [] })
    })

    it('loadAuthoritativeBatchForMirroring uses pair path per universal key', async () => {
        const order = ['ASSET#a'] as const
        mockAuthoritativeFromParticipationOrder
            .mockResolvedValueOnce({ ComponentId: 'ROOM#one', byAssets: [] } as never)
            .mockResolvedValueOnce({ ComponentId: 'ROOM#two', byAssets: [] } as never)

        const results = await loadAuthoritativeBatchForMirroring(
            ['ROOM#one', 'ROOM#two'],
            'ASSET#a',
            order
        )

        expect(results).toHaveLength(2)
        expect(mockAuthoritativeFromParticipationOrder).toHaveBeenCalledTimes(2)
        expect(mockAuthoritativeFromParticipationOrder).toHaveBeenNthCalledWith(
            1,
            'ROOM#one',
            order,
            internalCache.ComponentData
        )
        expect(mockAuthoritativeFromParticipationOrder).toHaveBeenNthCalledWith(
            2,
            'ROOM#two',
            order,
            internalCache.ComponentData
        )
    })
})

describe('deriveMirroringParticipationOrder', () => {
    const mockInternalCache = internalCache as unknown as {
        ComponentVerticals: { get: jest.Mock };
    }

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('does not call authoritativeFromParticipationOrder or partition handlers', async () => {
        mockInternalCache.ComponentVerticals.get.mockResolvedValue([
            { hops: [{ parentAssetId: 'ASSET#p', childAssetId: 'ASSET#c' }] },
        ])

        const order = await deriveMirroringParticipationOrder('ROOM#r1', 'ASSET#event')

        expect(order).toEqual(['ASSET#c', 'ASSET#event', 'ASSET#p'])
        expect(mockAuthoritativeFromParticipationOrder).not.toHaveBeenCalled()
    })
})
