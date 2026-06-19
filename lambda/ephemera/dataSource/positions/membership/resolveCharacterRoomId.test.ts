import internalCache from '../../../internalCache'
import { resolveCharacterRoomId, resolveLegalRoomIdFromRoomStack } from './resolveCharacterRoomId'

jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
        },
        CharacterMeta: {
            get: jest.fn(),
        },
        Global: {
            get: jest.fn(),
        },
    },
}))

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('resolveLegalRoomIdFromRoomStack', () => {
    it('returns top frame of trimmed ladder', () => {
        expect(resolveLegalRoomIdFromRoomStack(
            [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'TownSquare' },
            ],
            ['primitives', 'TownCenter']
        )).toBe('ROOM#TownSquare')
    })

    it('defaults to VORTEX when stack normalizes empty', () => {
        expect(resolveLegalRoomIdFromRoomStack(undefined, [])).toBe('ROOM#VORTEX')
    })
})

describe('resolveCharacterRoomId', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('prefers play membership over stale legacy meta and ladder', async () => {
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#Bridge'])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Test',
            RoomId: 'ROOM#VORTEX',
            RoomStack: [{ asset: 'primitives', RoomId: 'VORTEX' }],
            HomeId: 'ROOM#VORTEX',
            assets: [],
        })

        await expect(resolveCharacterRoomId('CHARACTER#Test')).resolves.toBe('ROOM#Bridge')
        expect(internalCacheMock.CharacterMeta.get).not.toHaveBeenCalled()
    })

    it('falls back to trimmed RoomStack when out of play', async () => {
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue([])
        internalCacheMock.Global.get.mockResolvedValue(['primitives', 'TownCenter'])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Test',
            RoomId: 'ROOM#VORTEX',
            RoomStack: [
                { asset: 'primitives', RoomId: 'VORTEX' },
                { asset: 'TownCenter', RoomId: 'Straightaway' },
            ],
            HomeId: 'ROOM#VORTEX',
            assets: [],
        })

        await expect(resolveCharacterRoomId('CHARACTER#Test')).resolves.toBe('ROOM#Straightaway')
    })
})
