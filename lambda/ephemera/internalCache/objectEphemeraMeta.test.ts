jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from '.'
import type { EphemeraMetaObject } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('ObjectEphemeraMeta', () => {
    const objectId = 'OBJECT#TestAnvil' as const

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('fetches from ephemeraDB on cache miss and caches the result', async () => {
        const row: EphemeraMetaObject = {
            EphemeraId: objectId,
            DataCategory: 'Meta::Object',
            stableKey: 'anvil',
        }
        ephemeraMock.getItem.mockResolvedValue(row)

        const first = await internalCache.ObjectEphemeraMeta.get(objectId)
        const second = await internalCache.ObjectEphemeraMeta.get(objectId)

        expect(first).toEqual(row)
        expect(second).toEqual(row)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: objectId, DataCategory: 'Meta::Object' },
            getAllFields: true,
        })
    })

    it('caches absence when no row exists', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)

        await expect(internalCache.ObjectEphemeraMeta.get(objectId)).resolves.toBeUndefined()
        await expect(internalCache.ObjectEphemeraMeta.get(objectId)).resolves.toBeUndefined()
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
    })

    it('invalidate clears entry so the next get refetches', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)

        await internalCache.ObjectEphemeraMeta.get(objectId)
        internalCache.ObjectEphemeraMeta.invalidate(objectId)
        await internalCache.ObjectEphemeraMeta.get(objectId)

        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(2)
    })

    it('clear drops all cached entries', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)
        await internalCache.ObjectEphemeraMeta.get(objectId)
        internalCache.clear()
        await internalCache.ObjectEphemeraMeta.get(objectId)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(2)
    })

    it('set can inject a value for tests', async () => {
        const row: EphemeraMetaObject = {
            EphemeraId: objectId,
            DataCategory: 'Meta::Object',
            stableKey: 'anvil',
        }
        internalCache.ObjectEphemeraMeta.set(objectId, row)
        await expect(internalCache.ObjectEphemeraMeta.get(objectId)).resolves.toEqual(row)
        expect(ephemeraMock.getItem).not.toHaveBeenCalled()
    })
})
