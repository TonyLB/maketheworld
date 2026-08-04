jest.mock('@tonylb/mtw-utilities/ts/dynamoDB', () => ({
    ephemeraDB: {
        getItem: jest.fn(),
        optimisticUpdate: jest.fn(),
        putItem: jest.fn(),
    },
}))

jest.mock('@tonylb/mtw-base/ts/coyoteGame', () => ({
    coyoteGameEnabled: true,
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
import { StandardCharacter } from '@tonylb/mtw-wml/ts/standardize/components/character'
import { confirmGuestCharacter } from './index'
import { GUEST_COYOTE_SITUATIONS } from './guestSituations'

const ephemeraDBMock = ephemeraDB as jest.Mocked<typeof ephemeraDB>
const internalCacheMock = internalCache as unknown as { ImprovisationComponentData: { get: jest.Mock; set: jest.Mock } }
const sendDeleteCacheRecordsMock = sendDeleteCacheRecords as jest.Mock
const queryAllRenderCacheDataCategoriesForComponentMock = queryAllRenderCacheDataCategoriesForComponent as jest.Mock

const messageBus = { publish: jest.fn() } as any

const characterComponent = (shortName?: string, situations?: unknown) => new StandardCharacter({
    tag: 'Character',
    universalKey: 'CHARACTER#guest-1',
    ...(shortName !== undefined ? { shortName } : {}),
    ...(situations !== undefined ? { situations: situations as any } : {}),
})

describe('confirmGuestCharacter (coyoteGameEnabled)', () => {
    beforeEach(() => {
        jest.clearAllMocks()
        ephemeraDBMock.getItem.mockResolvedValue({
            guestId: 'guest-1',
            guestName: 'Guest One',
        })
        ephemeraDBMock.optimisticUpdate.mockResolvedValue(undefined)
        ephemeraDBMock.putItem.mockResolvedValue(undefined)
        queryAllRenderCacheDataCategoriesForComponentMock.mockResolvedValue([])
        internalCacheMock.ImprovisationComponentData.get.mockResolvedValue({ component: characterComponent() })
    })

    it('writes the guest SITUATION#DEFAULT pair row when none exists yet', async () => {
        await confirmGuestCharacter('player-one', messageBus)

        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(expect.objectContaining({
            EphemeraId: 'CHARACTER#guest-1',
            DataCategory: 'ASSET#IMPROVISATION',
            tag: 'Character',
            shortName: 'player-one',
            situations: GUEST_COYOTE_SITUATIONS,
        }))
    })

    it('does not reintroduce a "his" pronoun in the guest prose', () => {
        const prose = JSON.stringify(GUEST_COYOTE_SITUATIONS)
        expect(prose).not.toMatch(/\bhis\b/i)
        expect(prose).toMatch(/their/i)
    })

    it('memo-patches ImprovisationComponentData when the pair row is (re)written', async () => {
        await confirmGuestCharacter('player-one', messageBus)

        expect(internalCacheMock.ImprovisationComponentData.set).toHaveBeenCalledWith(
            'CHARACTER#guest-1',
            'ASSET#IMPROVISATION',
            expect.anything(),
        )
    })

    it('deletes stale render-cache rows when repairing an out-of-date guest', async () => {
        internalCacheMock.ImprovisationComponentData.get.mockResolvedValue({
            component: characterComponent('player-one', []),
        })
        queryAllRenderCacheDataCategoriesForComponentMock.mockResolvedValue(['CACHE#abc'])

        await confirmGuestCharacter('player-one', messageBus)

        expect(sendDeleteCacheRecordsMock).toHaveBeenCalledWith(
            messageBus,
            'CHARACTER#guest-1',
            { componentId: 'CHARACTER#guest-1', dataCategories: ['CACHE#abc'] },
        )
    })

    it('skips the write entirely when the existing pair row already matches', async () => {
        internalCacheMock.ImprovisationComponentData.get.mockResolvedValue({
            component: characterComponent('player-one', GUEST_COYOTE_SITUATIONS),
        })

        await confirmGuestCharacter('player-one', messageBus)

        expect(ephemeraDBMock.putItem).not.toHaveBeenCalled()
        expect(internalCacheMock.ImprovisationComponentData.set).not.toHaveBeenCalled()
        expect(queryAllRenderCacheDataCategoriesForComponentMock).not.toHaveBeenCalled()
        expect(sendDeleteCacheRecordsMock).not.toHaveBeenCalled()
    })

    it('rewrites when the existing shortName is stale (e.g. renamed guest)', async () => {
        internalCacheMock.ImprovisationComponentData.get.mockResolvedValue({
            component: characterComponent('old-name', GUEST_COYOTE_SITUATIONS),
        })

        await confirmGuestCharacter('player-one', messageBus)

        expect(ephemeraDBMock.putItem).toHaveBeenCalledWith(expect.objectContaining({
            shortName: 'player-one',
        }))
    })

    it('does not attempt render-cache deletion when no stale rows exist', async () => {
        await confirmGuestCharacter('player-one', messageBus)

        expect(sendDeleteCacheRecordsMock).not.toHaveBeenCalled()
    })

    it('no longer writes a Description field on Meta::Character', async () => {
        await confirmGuestCharacter('player-one', messageBus)

        const updateReducer = ephemeraDBMock.optimisticUpdate.mock.calls[0]?.[0]?.updateReducer
        const draft: Record<string, unknown> = {}
        updateReducer!(draft)
        expect(draft.Description).toBeUndefined()

        expect(ephemeraDBMock.optimisticUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                updateKeys: expect.not.arrayContaining(['Description']),
            })
        )
    })
})
