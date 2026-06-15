import internalCache from '../../internalCache'
import { resolveHomeTargetForCharacter } from './resolveHomeTargetForCharacter'

jest.mock('../../internalCache', () => ({
    __esModule: true,
    default: {
        Positions: {
            getMembershipContainers: jest.fn(),
        },
        CharacterMeta: {
            get: jest.fn(),
        },
    },
}))

// @ts-ignore
const internalCacheMock = jest.mocked(internalCache, true)

describe('resolveHomeTargetForCharacter', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('returns Resolved when in play and home differs from current room', async () => {
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#current'])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Test',
            RoomId: 'ROOM#current',
            RoomStack: [],
            HomeId: 'ROOM#home',
            assets: [],
        })

        await expect(resolveHomeTargetForCharacter('CHARACTER#Test')).resolves.toEqual({
            type: 'Resolved',
            fromRoomId: 'ROOM#current',
            toRoomId: 'ROOM#home',
        })
    })

    it('returns NoExitContext when character is out of play', async () => {
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue([])

        await expect(resolveHomeTargetForCharacter('CHARACTER#Test')).resolves.toEqual({
            type: 'NoExitContext',
        })
    })

    it('returns AlreadyHome when current room matches HomeId', async () => {
        internalCacheMock.Positions.getMembershipContainers.mockResolvedValue(['ROOM#home'])
        internalCacheMock.CharacterMeta.get.mockResolvedValue({
            EphemeraId: 'CHARACTER#Test',
            Name: 'Test',
            RoomId: 'ROOM#home',
            RoomStack: [],
            HomeId: 'ROOM#home',
            assets: [],
        })

        await expect(resolveHomeTargetForCharacter('CHARACTER#Test')).resolves.toEqual({
            type: 'AlreadyHome',
        })
    })
})
