jest.mock('@tonylb/mtw-utilities/ts/dynamoDB/index')
import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB/index'

import internalCache from '.'
import type { EphemeraMetaRoom } from '@tonylb/mtw-interfaces/ts/ephemeraMeta'

const ephemeraMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('ComponentEphemeraMeta', () => {
    const roomId = 'ROOM#TestOne' as const

    beforeEach(() => {
        jest.clearAllMocks()
        jest.resetAllMocks()
        internalCache.clear()
    })

    it('fetches from ephemeraDB on cache miss and caches the result', async () => {
        const row: EphemeraMetaRoom = {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
            state: { marks: { markValue: [{ mark: 'MARK#m', value: 'x' }] } },
        }
        ephemeraMock.getItem.mockResolvedValue(row)

        const first = await internalCache.ComponentEphemeraMeta.get(roomId)
        const second = await internalCache.ComponentEphemeraMeta.get(roomId)

        expect(first).toEqual(row)
        expect(second).toEqual(row)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
        expect(ephemeraMock.getItem).toHaveBeenCalledWith({
            Key: { EphemeraId: roomId, DataCategory: 'Meta::Room' },
            getAllFields: true,
        })
    })

    it('caches absence when no row exists', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)

        await expect(internalCache.ComponentEphemeraMeta.get(roomId)).resolves.toBeUndefined()
        await expect(internalCache.ComponentEphemeraMeta.get(roomId)).resolves.toBeUndefined()
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(1)
    })

    it('invalidate clears entry so the next get refetches', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)

        await internalCache.ComponentEphemeraMeta.get(roomId)
        internalCache.ComponentEphemeraMeta.invalidate(roomId)
        await internalCache.ComponentEphemeraMeta.get(roomId)

        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(2)
    })

    it('clear drops all cached entries', async () => {
        ephemeraMock.getItem.mockResolvedValue(undefined)
        await internalCache.ComponentEphemeraMeta.get(roomId)
        internalCache.clear()
        await internalCache.ComponentEphemeraMeta.get(roomId)
        expect(ephemeraMock.getItem).toHaveBeenCalledTimes(2)
    })

    it('set can inject a value for tests', async () => {
        const row: EphemeraMetaRoom = {
            EphemeraId: roomId,
            DataCategory: 'Meta::Room',
        }
        internalCache.ComponentEphemeraMeta.set(roomId, row)
        await expect(internalCache.ComponentEphemeraMeta.get(roomId)).resolves.toEqual(row)
        expect(ephemeraMock.getItem).not.toHaveBeenCalled()
    })
})
