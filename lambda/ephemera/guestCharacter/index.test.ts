jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
        putItem: jest.fn(),
    },
}))

jest.mock('@tonylb/mtw-base/ts/coyoteGame', () => ({
    coyoteGameEnabled: false,
}))

jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        ImprovisationComponentData: {
            get: jest.fn(),
            set: jest.fn(),
        },
    },
}))

jest.mock('../dataSource/apiEphemera', () => ({
    sendDeleteCacheRecords: jest.fn(),
}))

jest.mock('../dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent', () => ({
    queryAllRenderCacheDataCategoriesForComponent: jest.fn(),
}))

import { ephemeraDB } from '@tonylb/mtw-utilities/ts/dynamoDB'
import internalCache from '../internalCache'
import { sendDeleteCacheRecords } from '../dataSource/apiEphemera'
import { queryAllRenderCacheDataCategoriesForComponent } from '../dataSource/renderCache/queryAllRenderCacheDataCategoriesForComponent'
import { confirmGuestCharacter } from './index'
import { DEFAULT_ROOM_STACK } from '../dataSource/positions/membership/trimEvictionLadder'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const internalCacheMock = internalCache as unknown as { ImprovisationComponentData: { get: jest.Mock; set: jest.Mock } }
const sendDeleteCacheRecordsMock = sendDeleteCacheRecords as jest.Mock
const queryAllRenderCacheDataCategoriesForComponentMock = queryAllRenderCacheDataCategoriesForComponent as jest.Mock

const messageBus = { publish: jest.fn() } as any

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

        await confirmGuestCharacter('player-one', messageBus)

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
        expect((draft.RoomStack as typeof DEFAULT_ROOM_STACK)[0]).not.toHaveProperty('timeWritten')
        expect(draft.RoomId).toBeUndefined()
    })

    it('does not write a guest situation facet or invalidate caches when coyoteGameEnabled is false', async () => {
        ephemeraDBMock.getItem.mockResolvedValue({
            guestId: 'guest-1',
            guestName: 'Guest One',
        })
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)

        await confirmGuestCharacter('player-one', messageBus)

        expect(ephemeraDBMock.putItem).not.toHaveBeenCalled()
        expect(internalCacheMock.ImprovisationComponentData.set).not.toHaveBeenCalled()
        expect(queryAllRenderCacheDataCategoriesForComponentMock).not.toHaveBeenCalled()
        expect(sendDeleteCacheRecordsMock).not.toHaveBeenCalled()
    })
})
