jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
    },
}))

jest.mock('@tonylb/mtw-base/ts/coyoteGame', () => ({
    coyoteGameEnabled: false,
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import { confirmGuestCharacter } from './index'
import { DEFAULT_ROOM_STACK } from '../dataSource/positions/membership/trimEvictionLadder'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>

describe('confirmGuestCharacter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('persists RoomStack instead of legacy RoomId', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            guestId: 'guest-1',
            guestName: 'Guest One',
        })
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)

        await confirmGuestCharacter('player-one')

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                updateKeys: expect.arrayContaining(['RoomStack']),
            })
        )
        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                updateKeys: expect.not.arrayContaining(['RoomId']),
            })
        )

        const updateReducer = ephemeraDBMock.optimisticUpdate.mock.calls[0]?.[0]?.updateReducer
        expect(updateReducer).toBeDefined()
        const draft: Record<string, unknown> = {}
        updateReducer!(draft)
        expect(draft.RoomStack).toEqual(DEFAULT_ROOM_STACK)
        expect(draft.RoomId).toBeUndefined()
    })
})
