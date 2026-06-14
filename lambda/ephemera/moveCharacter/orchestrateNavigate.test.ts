jest.mock('../internalCache', () => ({
    __esModule: true,
    default: {
        OrchestrateMessages: {
            newMessageGroup: jest.fn(() => 'UUID#MessageGroup'),
            before: jest.fn(() => 'UUID#Before'),
            after: jest.fn(() => 'UUID#After'),
        },
        PerceptionThreads: { register: jest.fn() },
    },
}))

jest.mock('../dataSource/perception/kickRoomHeaderBroadcast', () => ({
    getCharacterRoomPerspectiveKey: jest.fn(async () => 'perspective-key'),
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(async () => false),
}))

import internalCache from '../internalCache'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'

describe('orchestrateCharacterNavigate', () => {
    const messageBus = { publish: jest.fn() }
    const register = internalCache.PerceptionThreads.register as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('uses froms[0] as primaryDeparture when multiple prior containers', async () => {
        await orchestrateCharacterNavigate({
            payload: {
                type: 'MoveCharacter',
                characterId: 'CHARACTER#Test',
                roomId: 'ROOM#TestTwo',
            },
            characterMeta: {
                EphemeraId: 'CHARACTER#Test',
                Name: 'Test',
                RoomId: 'ROOM#Fallback',
                RoomStack: [{ asset: 'primitives', RoomId: 'Fallback' }],
                HomeId: 'ROOM#Fallback',
                assets: ['primitives'],
            },
            froms: ['ROOM#VORTEX', 'ROOM#TestThree'],
            to: 'ROOM#TestTwo',
            beatAnchorTime: 1_700_000_000_000,
            messageBus: messageBus as any,
        })

        expect(register).toHaveBeenCalledWith(expect.objectContaining({
            departureRoomId: 'ROOM#VORTEX',
        }))
        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'MapUpdate',
            previousRoomId: 'ROOM#VORTEX',
            roomId: 'ROOM#TestTwo',
        }))
    })
})
