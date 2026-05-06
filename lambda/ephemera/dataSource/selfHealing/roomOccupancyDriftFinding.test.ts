import { handleRoomOccupancyDriftFinding } from './roomOccupancyDriftFinding'
import { connectionDB, ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../../internalCache'

jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    connectionDB: {
        getItem: jest.fn(),
    },
    ephemeraDB: {
        getItem: jest.fn(),
        query: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        ComponentEphemeraMeta: { invalidate: jest.fn() },
        ComponentStackMerge: { invalidate: jest.fn() },
        RoomCharacterList: { set: jest.fn() },
    },
}))

describe('handleRoomOccupancyDriftFinding', () => {
    const messageBus = {
        send: jest.fn(),
    } as any

    beforeEach(() => {
        jest.clearAllMocks()
        ;(ephemeraDB.optimisticUpdate as jest.Mock).mockImplementation(async ({ successCallback, updateReducer }) => {
            const draft: any = {}
            updateReducer(draft)
            successCallback?.({ activeCharacters: draft.activeCharacters })
            return undefined
        })
    })

    it('is idempotent when occupancy already matches authoritative state', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({
            activeCharacters: [{
                EphemeraId: 'CHARACTER#alpha',
                DisplayName: 'Alpha',
                SessionIds: ['SESSION#1'],
            }],
        })
        ;(ephemeraDB.query as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#alpha', DataCategory: 'Meta::Character', RoomId: 'ROOM#roomA', Name: 'Alpha' },
        ])
        ;(connectionDB.getItem as jest.Mock).mockResolvedValue({ sessions: ['SESSION#1'] })

        const result = await handleRoomOccupancyDriftFinding({
            roomId: 'ROOM#roomA',
            messageBus,
        })

        expect(result).toEqual({ changed: false, checkLocationQueued: false })
        expect(ephemeraDB.optimisticUpdate).not.toHaveBeenCalled()
        expect(messageBus.send).not.toHaveBeenCalled()
    })

    it('repairs drifting occupancy and refreshes cache + room update signal', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({
            activeCharacters: [{
                EphemeraId: 'CHARACTER#alpha',
                DisplayName: 'Alpha',
                SessionIds: ['SESSION#stale'],
            }],
        })
        ;(ephemeraDB.query as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#alpha', DataCategory: 'Meta::Character', RoomId: 'ROOM#roomA', Name: 'Alpha' },
            { EphemeraId: 'CHARACTER#beta', DataCategory: 'Meta::Character', RoomId: 'ROOM#roomA', Name: 'Beta' },
        ])
        ;(connectionDB.getItem as jest.Mock)
            .mockResolvedValueOnce({ sessions: ['SESSION#1'] })
            .mockResolvedValueOnce({ sessions: ['SESSION#2'] })

        const result = await handleRoomOccupancyDriftFinding({
            roomId: 'ROOM#roomA',
            messageBus,
        })

        expect(result).toEqual({ changed: true, checkLocationQueued: false })
        expect(ephemeraDB.optimisticUpdate).toHaveBeenCalledTimes(1)
        expect(internalCache.ComponentEphemeraMeta.invalidate).toHaveBeenCalledWith('ROOM#roomA')
        expect(internalCache.ComponentStackMerge.invalidate).toHaveBeenCalledWith('ROOM#roomA')
        expect(internalCache.RoomCharacterList.set).toHaveBeenCalled()
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'RoomUpdate',
            roomId: 'ROOM#roomA',
        })
    })

    it('queues CheckLocation for occupancy entries lacking authoritative room', async () => {
        ;(ephemeraDB.getItem as jest.Mock).mockResolvedValue({
            activeCharacters: [{
                EphemeraId: 'CHARACTER#orphan',
                DisplayName: 'Orphan',
                SessionIds: ['SESSION#9'],
            }],
        })
        ;(ephemeraDB.query as jest.Mock).mockResolvedValue([
            { EphemeraId: 'CHARACTER#orphan', DataCategory: 'Meta::Character', Name: 'Orphan' },
        ])
        ;(connectionDB.getItem as jest.Mock).mockResolvedValue({ sessions: [] })

        const result = await handleRoomOccupancyDriftFinding({
            roomId: 'ROOM#roomA',
            messageBus,
        })

        expect(result.checkLocationQueued).toBe(true)
        expect(messageBus.send).toHaveBeenCalledWith({
            type: 'CheckLocation',
            roomId: 'ROOM#roomA',
        })
    })
})
