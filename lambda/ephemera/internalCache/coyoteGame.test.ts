jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'
import { CacheCoyoteGameData } from './coyoteGame'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('CacheCoyoteGameData', () => {
    const key = {
        EphemeraId: 'Global',
        DataCategory: 'CoyoteGame#Intent',
    } as const

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
    })

    it('returns cached in-memory intent without hitting Dynamo', async () => {
        const generateIntent = jest.fn().mockResolvedValue('Hypothesis: Fresh')
        const cache = new CacheCoyoteGameData({ generateIntent })

        cache.set({ key: 'intent', value: 'Hypothesis: Cached' })

        await expect(cache.get('intent')).resolves.toBe('Hypothesis: Cached')
        expect(ephemeraMock.getItem).not.toHaveBeenCalled()
        expect(generateIntent).not.toHaveBeenCalled()
    })

    it('reads intent from durable Global row on local miss', async () => {
        const generateIntent = jest.fn().mockResolvedValue('Hypothesis: Fresh')
        ephemeraMock.getItem.mockResolvedValue({ intent: 'Hypothesis: Durable' })
        const cache = new CacheCoyoteGameData({ generateIntent })

        await expect(cache.get('intent')).resolves.toBe('Hypothesis: Durable')
        expect(ephemeraMock.getItem).toHaveBeenCalledWith({
            Key: key,
            ProjectionFields: ['intent'],
        })
        expect(generateIntent).not.toHaveBeenCalled()
    })

    it('generates and persists intent on durable miss', async () => {
        const generateIntent = jest.fn().mockResolvedValue('Hypothesis: Generated')
        ephemeraMock.getItem.mockResolvedValue(undefined)
        const cache = new CacheCoyoteGameData({ generateIntent })

        await expect(cache.get('intent')).resolves.toBe('Hypothesis: Generated')
        expect(generateIntent).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.putItem).toHaveBeenCalledWith({
            ...key,
            intent: 'Hypothesis: Generated',
        })
    })

    it('invalidate clears local cache and deletes durable row', async () => {
        const generateIntent = jest.fn().mockResolvedValue('Hypothesis: Fresh')
        ephemeraMock.getItem.mockResolvedValueOnce({ intent: 'Hypothesis: Durable' }).mockResolvedValueOnce(undefined)
        const cache = new CacheCoyoteGameData({ generateIntent })

        await expect(cache.get('intent')).resolves.toBe('Hypothesis: Durable')
        await cache.invalidate('intent')
        await expect(cache.get('intent')).resolves.toBe('Hypothesis: Fresh')

        expect(ephemeraMock.deleteItem).toHaveBeenCalledWith(key)
        expect(generateIntent).toHaveBeenCalledTimes(1)
    })
})
