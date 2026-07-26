jest.mock('../../../internalCache', () => ({
    __esModule: true,
    default: {
        PerceptionThreads: { register: jest.fn() },
    },
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    getCharacterRoomPerspectiveKey: jest.fn(async () => 'perspective-key'),
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(async () => false),
}))

import internalCache from '../../../internalCache'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'
import { navigateLeaveSlotId, NAVIGATE_ARRIVE_SLOT_ID, NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'

describe('orchestrateCharacterNavigate', () => {
    const messageBus = { publish: jest.fn() }
    const register = internalCache.PerceptionThreads.register as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const bundleDeclares = () => (
        messageBus.publish.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Bundle Declared')
    )

    it('uses froms[0] as primaryDeparture when multiple prior containers', async () => {
        await orchestrateCharacterNavigate({
            characterId: 'CHARACTER#Test',
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
            bundleId: 'BUNDLE#test',
            messageBus: messageBus as any,
        })

        expect(register).toHaveBeenCalledWith(expect.objectContaining({
            threadKind: 'characterMove',
            characterId: 'CHARACTER#Test',
            targets: ['CHARACTER#Test'],
            bundleId: 'BUNDLE#test',
            slotId: NAVIGATE_HEADER_SLOT_ID,
        }))
        expect(messageBus.publish).not.toHaveBeenCalledWith(expect.objectContaining({
            type: 'MapUpdate',
        }))

        const declares = bundleDeclares()
        expect(declares).toHaveLength(1)
        const content = await declares[0].getContent()
        expect(content).toEqual({
            bundleId: 'BUNDLE#test',
            slots: [
                { slotId: navigateLeaveSlotId('ROOM#VORTEX'), expectedPublishType: 'WorldMessage' },
                { slotId: navigateLeaveSlotId('ROOM#TestThree'), expectedPublishType: 'WorldMessage' },
                { slotId: NAVIGATE_HEADER_SLOT_ID, expectedPublishType: 'PerceptionMessage' },
                { slotId: NAVIGATE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' },
            ],
        })
    })

    it('mints its own bundleId when the caller supplies none (connect/disconnect/repair callers)', async () => {
        await orchestrateCharacterNavigate({
            characterId: 'CHARACTER#Test',
            characterMeta: {
                EphemeraId: 'CHARACTER#Test',
                Name: 'Test',
                RoomId: 'ROOM#Fallback',
                RoomStack: [{ asset: 'primitives', RoomId: 'Fallback' }],
                HomeId: 'ROOM#Fallback',
                assets: ['primitives'],
            },
            froms: [],
            to: 'ROOM#TestTwo',
            beatAnchorTime: 1_700_000_000_000,
            messageBus: messageBus as any,
        })

        expect(register).toHaveBeenCalledWith(expect.objectContaining({
            threadKind: 'characterMove',
            bundleId: expect.any(String),
            slotId: NAVIGATE_HEADER_SLOT_ID,
        }))
        expect(bundleDeclares()).toHaveLength(1)
    })
})
