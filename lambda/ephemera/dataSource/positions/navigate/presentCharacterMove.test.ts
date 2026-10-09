jest.mock('../../messageOrchestration', () => ({
    __esModule: true,
    registerIngressSlot: jest.fn(),
}))

jest.mock('../../perception/kickRoomHeaderBroadcast', () => ({
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(async () => false),
}))

import { registerIngressSlot } from '../../messageOrchestration'
import { kickPassiveRenderRequestedForCharacterInRoom } from '../../perception/kickRoomHeaderBroadcast'
import { presentCharacterMove } from './presentCharacterMove'
import { compilePositionKernelOp } from '../manipulation/kernel/compile/compilePositionKernelOp'
import { buildCharacterMoveOp } from '../manipulation/membership/buildCharacterMoveOp'
import type { MoveHeaderBinding } from '../manipulation/kernel/compile/positionKernelOp'
import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'

const CHARACTER_ID = 'CHARACTER#Test' as EphemeraCharacterId
const TO_ROOM = 'ROOM#TestTwo' as EphemeraRoomId
const BEAT = 1_700_000_000_000

const HEADER: MoveHeaderBinding = { perspectiveKey: 'perspective-key', assets: ['primitives'] }

const buildPlan = (froms: EphemeraRoomId[], header: MoveHeaderBinding | null = HEADER) =>
    compilePositionKernelOp(buildCharacterMoveOp({
        characterId: CHARACTER_ID,
        characterName: 'Test',
        froms,
        to: TO_ROOM,
        intentKind: 'navigate',
        intentFromRoomId: froms[0],
        header,
    }))

const buildDisconnectPlan = (froms: string[]) => compilePositionKernelOp(buildCharacterMoveOp({
    characterId: CHARACTER_ID,
    characterName: 'Test',
    froms: froms as any,
    to: null,
    intentKind: 'disconnect',
    header: null,
}))

describe('presentCharacterMove', () => {
    const messageBus = { publish: jest.fn() }
    const registerIngressSlotMock = registerIngressSlot as jest.Mock

    beforeEach(() => {
        jest.clearAllMocks()
    })

    const published = () => messageBus.publish.mock.calls.map((call) => call[0])
    const worldMessages = () => published().filter((message) => message?.displayProtocol === 'WorldMessage')

    it('presents the compiled plan in order: leave, header, arrive, stamped from the commit\'s beat anchor', async () => {
        const plan = buildPlan(['ROOM#VORTEX' as EphemeraRoomId])

        await presentCharacterMove({
            characterId: CHARACTER_ID,
            plan,
            //  Narration compiled ==> the commit produced a capture per host the compiler bracketed.
            captures: new Map([
                ['capture:from:ROOM#VORTEX', ['CHARACTER#Test']],
                ['capture:to', ['CHARACTER#Test']],
            ]) as any,
            beatAnchorTime: BEAT,
            messageBus: messageBus as any,
        })

        const [leave, arrive] = worldMessages()
        expect(leave).toEqual(expect.objectContaining({ createdTime: BEAT, targets: [CHARACTER_ID] }))
        expect(arrive).toEqual(expect.objectContaining({ createdTime: BEAT + 2, targets: [CHARACTER_ID] }))
        expect(leave.messageId).not.toEqual(arrive.messageId)

        expect(registerIngressSlotMock).toHaveBeenCalledTimes(1)
        const [bus, address, spec, kickoff] = registerIngressSlotMock.mock.calls[0]!
        expect(bus).toBe(messageBus)
        expect(address).toEqual({ createdTime: BEAT + 1, messageId: expect.stringMatching(/^MESSAGE#/) })
        expect(spec).toEqual(expect.objectContaining({
            componentId: TO_ROOM,
            perspectiveKey: 'perspective-key',
            targets: [CHARACTER_ID],
            contentStream: 'render',
            format: 'header',
        }))

        await kickoff()
        expect(kickPassiveRenderRequestedForCharacterInRoom).toHaveBeenCalledWith({
            roomId: TO_ROOM,
            characterId: CHARACTER_ID,
            assets: ['primitives'],
            messageBus,
        })
    })

    it('declares no bundle', async () => {
        const plan = buildPlan(['ROOM#VORTEX' as EphemeraRoomId])

        await presentCharacterMove({
            characterId: CHARACTER_ID,
            plan,
            captures: new Map([['capture:from:ROOM#VORTEX', [CHARACTER_ID]], ['capture:to', [CHARACTER_ID]]]) as any,
            beatAnchorTime: BEAT,
            messageBus: messageBus as any,
        })

        expect(published().filter((message) => message?.type === 'StreamingEvent')).toEqual([])
    })

    it('registers no header when the plan carries none (disconnect)', async () => {
        const plan = buildDisconnectPlan(['ROOM#VORTEX'])

        await presentCharacterMove({
            characterId: CHARACTER_ID,
            plan,
            captures: new Map([['capture:from:ROOM#VORTEX', [CHARACTER_ID]]]) as any,
            beatAnchorTime: BEAT,
            messageBus: messageBus as any,
        })

        expect(registerIngressSlotMock).not.toHaveBeenCalled()
        expect(worldMessages()).toHaveLength(1)
        expect(published().some((message) => message?.type === 'Perception')).toBe(false)
    })

    it('does nothing without a plan', async () => {
        await presentCharacterMove({ characterId: CHARACTER_ID, messageBus: messageBus as any })

        expect(messageBus.publish).not.toHaveBeenCalled()
        expect(registerIngressSlotMock).not.toHaveBeenCalled()
    })
})
