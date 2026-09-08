jest.mock('../../messageOrchestration', () => ({
    __esModule: true,
    registerIngressSlot: jest.fn(),
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(async () => false),
}))

import { registerIngressSlot } from '../../messageOrchestration'
import { kickPassiveRenderRequestedForCharacterInRoom } from '../../perception/kickRoomHeaderBroadcast'
import { orchestrateCharacterNavigate } from './orchestrateNavigate'
import { NAVIGATE_HEADER_SLOT_ID } from './navigateBundleSlotIds'
import { moveLeaveSlotId, MOVE_ARRIVE_SLOT_ID } from '../manipulation/kernel/compile/moveBundleSlotIds'
import { compilePositionKernelOp } from '../manipulation/kernel/compile/compilePositionKernelOp'
import { buildCharacterMoveOp } from '../manipulation/membership/buildCharacterMoveOp'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import type { MessageOrchestrationSlotSpec } from '../../messageOrchestration/localApiEvents'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId

const characterMeta = {
    EphemeraId: CHARACTER_ID,
    Name: 'Test',
    RoomId: 'ROOM#Fallback' as EphemeraRoomId,
    RoomStack: [{ asset: 'primitives', RoomId: 'Fallback' }],
    HomeId: 'ROOM#Fallback' as EphemeraRoomId,
    assets: ['primitives'],
}

const HEADER_SLOT: MessageOrchestrationSlotSpec = {
    slotId: NAVIGATE_HEADER_SLOT_ID,
    expectedPublishType: 'PerceptionMessage',
    componentId: TO_ROOM,
    perspectiveKey: 'perspective-key',
    targets: [CHARACTER_ID],
    contentStream: 'render',
    format: 'header',
}

const buildPlan = (froms: EphemeraRoomId[], bundleId: string, headerSlot: MessageOrchestrationSlotSpec | null = HEADER_SLOT) =>
    compilePositionKernelOp(buildCharacterMoveOp({
        characterId: CHARACTER_ID,
        characterName: characterMeta.Name,
        froms,
        to: TO_ROOM,
        bundleId,
        intentKind: 'navigate',
        intentFromRoomId: froms[0],
        headerSlot,
    }))

describe('orchestrateCharacterNavigate', () => {
    const messageBus = { publish: jest.fn() }
    const registerIngressSlotMock = registerIngressSlot as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const bundleDeclares = () => (
        messageBus.publish.mock.calls
            .map((call) => call[0])
            .filter((message) => message?.type === 'StreamingEvent' && message?.header?.type === 'Message Bundle Declared')
    )

    it('presents the already-compiled plan, and declares the bundle from plan.slots', async () => {
        const plan = buildPlan(['ROOM#VORTEX' as EphemeraRoomId, 'ROOM#TestThree' as EphemeraRoomId], 'BUNDLE#test')

        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            bundleId: 'BUNDLE#test',
            plan,
            //  Narration compiled ==> the commit produced a capture per host the compiler bracketed.
            //  Production always satisfies this (commitStepSequence's success result types `captures`
            //  as required); presentStepSequence throws rather than falling back to a live roster if
            //  it ever doesn't, so the fixture supplies what a real commit would have.
            captures: new Map([
                ['capture:from:ROOM#VORTEX', ['CHARACTER#Test']],
                ['capture:from:ROOM#TestThree', ['CHARACTER#Test']],
                ['capture:to', ['CHARACTER#Test']],
            ]) as any,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).toHaveBeenCalledWith(
            messageBus,
            'BUNDLE#test',
            expect.objectContaining({
                slotId: NAVIGATE_HEADER_SLOT_ID,
                componentId: TO_ROOM,
                perspectiveKey: 'perspective-key',
                targets: [CHARACTER_ID],
                contentStream: 'render',
                format: 'header',
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
                { slotId: moveLeaveSlotId('ROOM#VORTEX'), expectedPublishType: 'WorldMessage' },
                { slotId: moveLeaveSlotId('ROOM#TestThree'), expectedPublishType: 'WorldMessage' },
                {
                    slotId: NAVIGATE_HEADER_SLOT_ID,
                    expectedPublishType: 'PerceptionMessage',
                    componentId: TO_ROOM,
                    perspectiveKey: 'perspective-key',
                    targets: [CHARACTER_ID],
                    contentStream: 'render',
                    format: 'header',
                },
                { slotId: MOVE_ARRIVE_SLOT_ID, expectedPublishType: 'WorldMessage' },
            ],
        })
    })

    it('mints its own bundleId when the caller supplies none (connect/disconnect/repair callers)', async () => {
        const plan = buildPlan([], 'BUNDLE#unused-since-plan-already-baked-it-in')

        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            plan,
            captures: new Map([['capture:to', ['CHARACTER#Test']]]) as any,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).toHaveBeenCalledWith(
            messageBus,
            expect.any(String),
            expect.objectContaining({ contentStream: 'render', format: 'header' }),
            expect.any(Function)
        )
        const declares = bundleDeclares()
        expect(declares).toHaveLength(1)
        const content = await declares[0].getContent()
        expect(content.slots).toContainEqual(expect.objectContaining({
            slotId: NAVIGATE_HEADER_SLOT_ID,
            componentId: TO_ROOM,
            perspectiveKey: 'perspective-key',
            targets: [CHARACTER_ID],
            contentStream: 'render',
            format: 'header',
        }))
    })

    it('registerIngressSlot\'s kickoff callback invokes kickPassiveRenderRequestedForCharacterInRoom', async () => {
        const plan = buildPlan([], 'BUNDLE#test')

        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            bundleId: 'BUNDLE#test',
            plan,
            captures: new Map([['capture:to', ['CHARACTER#Test']]]) as any,
            messageBus: messageBus as any,
        })

        const kickoff = registerIngressSlotMock.mock.calls[0][3]
        await kickoff()

        expect(kickPassiveRenderRequestedForCharacterInRoom).toHaveBeenCalledWith(expect.objectContaining({
            roomId: TO_ROOM,
            characterId: CHARACTER_ID,
            assets: ['primitives'],
        }))
    })

    it('falls back to a direct Perception message when there is no valid perspective (no header slot in the plan)', async () => {
        const plan = buildPlan([], 'BUNDLE#test', null)

        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            bundleId: 'BUNDLE#test',
            plan,
            captures: new Map([['capture:to', ['CHARACTER#Test']]]) as any,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).not.toHaveBeenCalled()
        expect(messageBus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'Perception',
            characterId: CHARACTER_ID,
            ephemeraId: TO_ROOM,
            header: true,
        }))
    })

    it('does nothing when to is null (repair navigate-tail with no destination)', async () => {
        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: null,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('does nothing when plan is absent', async () => {
        await orchestrateCharacterNavigate({
            characterId: CHARACTER_ID,
            characterMeta,
            to: TO_ROOM,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).not.toHaveBeenCalled()
        expect(messageBus.publish).not.toHaveBeenCalled()
    })
})
