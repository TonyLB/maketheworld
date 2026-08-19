const optimisticUpdateMock = jest.fn()
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        optimisticUpdate: (...args: unknown[]) => optimisticUpdateMock(...args),
    },
}))

const coyoteGameGetMock = jest.fn()
jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        CoyoteGame: {
            get: (...args: unknown[]) => coyoteGameGetMock(...args),
        },
    },
}))

const collectActiveCharactersInCoyoteRoomsMock = jest.fn()
jest.mock('../coyoteGame/utilities/collectActiveCharactersInCoyoteRooms', () => ({
    collectActiveCharactersInCoyoteRooms: (...args: unknown[]) => collectActiveCharactersInCoyoteRoomsMock(...args),
}))

import { persistClearStoredLudicGraphs } from './persistClearStoredLudicGraphs'

describe('persistClearStoredLudicGraphs', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('issues a REMOVE update for every game room and active character', async () => {
        coyoteGameGetMock.mockResolvedValue(['VORTEX', 'CORNER'])
        collectActiveCharactersInCoyoteRoomsMock.mockResolvedValue(['CHARACTER#Alice', 'CHARACTER#Bob'])
        optimisticUpdateMock.mockResolvedValue(undefined)

        const result = await persistClearStoredLudicGraphs()

        expect(result).toEqual({
            ok: true,
            clearedRoomIds: ['ROOM#VORTEX', 'ROOM#CORNER'],
            clearedCharacterIds: ['CHARACTER#Alice', 'CHARACTER#Bob'],
        })
        expect(optimisticUpdateMock).toHaveBeenCalledTimes(4)
        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { EphemeraId: 'ROOM#VORTEX', DataCategory: 'Meta::Room' },
            updateKeys: ['ludicGraph'],
        }))
        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { EphemeraId: 'ROOM#CORNER', DataCategory: 'Meta::Room' },
            updateKeys: ['ludicGraph'],
        }))
        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { EphemeraId: 'CHARACTER#Alice', DataCategory: 'Meta::Character' },
            updateKeys: ['ludicGraph'],
        }))
        expect(optimisticUpdateMock).toHaveBeenCalledWith(expect.objectContaining({
            Key: { EphemeraId: 'CHARACTER#Bob', DataCategory: 'Meta::Character' },
            updateKeys: ['ludicGraph'],
        }))

        const draft: { ludicGraph?: unknown } = { ludicGraph: { nodes: [] } }
        optimisticUpdateMock.mock.calls[0][0].updateReducer(draft)
        expect(draft.ludicGraph).toBeUndefined()
    })

    it('is a no-op when there are no game rooms and no active characters', async () => {
        coyoteGameGetMock.mockResolvedValue([])
        collectActiveCharactersInCoyoteRoomsMock.mockResolvedValue([])

        const result = await persistClearStoredLudicGraphs()

        expect(result).toEqual({
            ok: true,
            clearedRoomIds: [],
            clearedCharacterIds: [],
        })
        expect(optimisticUpdateMock).not.toHaveBeenCalled()
    })

    it('surfaces an error rather than throwing when a dependency rejects', async () => {
        coyoteGameGetMock.mockResolvedValue(['VORTEX'])
        collectActiveCharactersInCoyoteRoomsMock.mockResolvedValue([])
        optimisticUpdateMock.mockRejectedValue(new Error('conditional check failed'))

        const result = await persistClearStoredLudicGraphs()

        expect(result).toEqual({ ok: false, errorMessage: 'conditional check failed' })
    })

    it('accepts injected dependencies without touching the real cache or table', async () => {
        const clearRoomLudicGraph = jest.fn().mockResolvedValue(undefined)
        const clearCharacterLudicGraph = jest.fn().mockResolvedValue(undefined)

        const result = await persistClearStoredLudicGraphs({
            getGameRooms: async () => ['BRIDGE'],
            getActiveCharactersInCoyoteRooms: async () => ['CHARACTER#Coyote'],
            clearRoomLudicGraph,
            clearCharacterLudicGraph,
        })

        expect(result).toEqual({
            ok: true,
            clearedRoomIds: ['ROOM#BRIDGE'],
            clearedCharacterIds: ['CHARACTER#Coyote'],
        })
        expect(clearRoomLudicGraph).toHaveBeenCalledWith('ROOM#BRIDGE')
        expect(clearCharacterLudicGraph).toHaveBeenCalledWith('CHARACTER#Coyote')
        expect(coyoteGameGetMock).not.toHaveBeenCalled()
        expect(collectActiveCharactersInCoyoteRoomsMock).not.toHaveBeenCalled()
        expect(optimisticUpdateMock).not.toHaveBeenCalled()
    })
})
