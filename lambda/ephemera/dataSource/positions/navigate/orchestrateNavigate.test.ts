jest.mock('../../messageOrchestration', () => ({
    __esModule: true,
    registerIngressSlot: jest.fn(),
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    getCharacterRoomPerspectiveKey: jest.fn(async () => 'perspective-key'),
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(async () => false),
}))

import { registerIngressSlot } from '../../messageOrchestration'
import { getCharacterRoomPerspectiveKey, kickPassiveRenderRequestedForCharacterInRoom } from '../../perception/kickRoomHeaderBroadcast'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'
import { navigateLeaveSlotId, NAVIGATE_ARRIVE_SLOT_ID, NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'

describe('orchestrateCharacterNavigate', () => {
    const messageBus = { publish: jest.fn() }
    const registerIngressSlotMock = registerIngressSlot as jest.Mock
    const getCharacterRoomPerspectiveKeyMock = getCharacterRoomPerspectiveKey as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
        getCharacterRoomPerspectiveKeyMock.mockResolvedValue('perspective-key')
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
            bundleId: 'BUNDLE#test',
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).toHaveBeenCalledWith(
            messageBus,
            'BUNDLE#test',
            expect.objectContaining({
                slotId: NAVIGATE_HEADER_SLOT_ID,
                componentId: 'ROOM#TestTwo',
                perspectiveKey: 'perspective-key',
                targets: ['CHARACTER#Test'],
                threadKind: 'characterMove',
            }),
            expect.any(Function)
        )
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
                {
                    slotId: NAVIGATE_HEADER_SLOT_ID,
                    expectedPublishType: 'PerceptionMessage',
                    componentId: 'ROOM#TestTwo',
                    perspectiveKey: 'perspective-key',
                    targets: ['CHARACTER#Test'],
                    threadKind: 'characterMove',
                },
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
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({ threadKind: 'characterMove' }),
            expect.any(Function)
        )
        const declares = bundleDeclares()
        expect(declares).toHaveLength(1)
        const content = await declares[0].getContent()
        expect(content.slots).toContainEqual(expect.objectContaining({
            slotId: NAVIGATE_HEADER_SLOT_ID,
            componentId: 'ROOM#TestTwo',
            perspectiveKey: 'perspective-key',
            targets: ['CHARACTER#Test'],
            threadKind: 'characterMove',
        }))
    })

    it('registerIngressSlot\'s kickoff callback invokes kickPassiveRenderRequestedForCharacterInRoom', async () => {
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
            bundleId: 'BUNDLE#test',
            messageBus: messageBus as any,
        })

        const kickoff = registerIngressSlotMock.mock.calls[0][3]
        await kickoff()

        expect(kickPassiveRenderRequestedForCharacterInRoom).toHaveBeenCalledWith(expect.objectContaining({
            roomId: 'ROOM#TestTwo',
            characterId: 'CHARACTER#Test',
            assets: ['primitives'],
        }))
    })

    it('falls back to a direct Perception message when there is no valid perspective (no header slot to register)', async () => {
        getCharacterRoomPerspectiveKeyMock.mockResolvedValueOnce(null)

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
            bundleId: 'BUNDLE#test',
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).not.toHaveBeenCalled()
        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Perception',
            characterId: 'CHARACTER#Test',
            ephemeraId: 'ROOM#TestTwo',
            header: true,
        }))
    })
})
