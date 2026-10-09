/**
 * Payoff test for the compiler-stamped presentation order (messageBundleRetirement Slice 2): a
 * character navigates into a room whose render is **not cached**, and the PublishMessages the
 * server emits --- in emitted order --- carry the transcript order themselves. No bundle is
 * declared anywhere.
 *
 * Real, unmocked: `compilePositionKernelOp` (leave, header, arrive order), `presentStepSequence` (stamping), and `messageOrchestration`'s content ingress (the header
 * listener, its placeholder wave and its terminal wave). Stubbed: the passive-render kickoff, which
 * stands in for the render pipeline by reporting a "Generating..." placeholder and then the
 * terminal render into the real ingress, as an uncached room does.
 *
 * The client half of the payoff is `charcoal-client/src/slices/messages/navigateStampedOrder.test.ts`,
 * which feeds a wire-shaped copy of these rows into the real messages slice (no cross-package
 * harness exists; keep the two fixtures in step).
 */
jest.mock('@tonylb/mtw-utilities/ts/dynamoDB')
jest.mock('../publishMessage', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(undefined),
}))
jest.mock('./perception/kickRoomHeaderBroadcast', () => ({
    __esModule: true,
    kickPassiveRenderRequestedForCharacterInRoom: jest.fn(),
}))

import type { EphemeraCharacterId, EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import messageBus from '../messageBus'
import type { PublishMessage } from '../messageBus/baseClasses'
import { reportIngressContent } from './messageOrchestration'
import { kickPassiveRenderRequestedForCharacterInRoom } from './perception/kickRoomHeaderBroadcast'
import { presentStepSequence } from './positions/manipulation/kernel/presentStepSequence'
import { compilePositionKernelOp } from './positions/manipulation/kernel/compile/compilePositionKernelOp'
import { buildCharacterMoveOp } from './positions/manipulation/membership/buildCharacterMoveOp'

const MOVER = 'CHARACTER#mover' as EphemeraCharacterId
const OBSERVER = 'CHARACTER#observer' as EphemeraCharacterId
const FROM_ROOM = 'ROOM#departure' as EphemeraRoomId
const TO_ROOM = 'ROOM#arrival' as EphemeraRoomId
const PERSPECTIVE_KEY = 'PERSPECTIVE#v1#abc123'
const BEAT = 1_700_000_000_000

const kickMock = kickPassiveRenderRequestedForCharacterInRoom as jest.Mock

describe('navigate into an uncached room: stamped presentation order (integration)', () => {
    let published: PublishMessage[]

    beforeEach(() => {
        jest.clearAllMocks()
        messageBus.clear()
        published = []
        jest.spyOn(messageBus, 'publish').mockImplementation(((message: PublishMessage) => { published.push(message) }) as any)
        kickMock.mockImplementation(async () => {
            reportIngressContent(messageBus, TO_ROOM, PERSPECTIVE_KEY, 'render', {
                kind: 'roomPlaceholder',
                componentId: TO_ROOM,
                bodyText: '',
                status: 'generating',
            })
            reportIngressContent(messageBus, TO_ROOM, PERSPECTIVE_KEY, 'render', {
                kind: 'roomRender',
                componentId: TO_ROOM,
                renderedContent: { displayName: ['Arrival Hall'], summary: [], description: ['A quiet hall.'] },
            })
            return true
        })
    })

    it('emits leave, header (placeholder then terminal, one MessageId), arrive --- ordered by their own times, with no bundle', async () => {
        const plan = compilePositionKernelOp(buildCharacterMoveOp({
            characterId: MOVER,
            characterName: 'Tess',
            froms: [FROM_ROOM],
            to: TO_ROOM,
            intentKind: 'navigate',
            intentFromRoomId: FROM_ROOM,
            header: { perspectiveKey: PERSPECTIVE_KEY, assets: [] },
        }))

        await presentStepSequence(
            plan.steps,
            MOVER,
            { streamEvent: async () => {}, messageBus },
            new Map([
                [`capture:from:${FROM_ROOM}`, [MOVER, OBSERVER]],
                ['capture:to', [MOVER]],
            ]),
            BEAT
        )

        expect(published.some((message: any) => message.type === 'StreamingEvent')).toBe(false)

        const leave = published.find((message: any) => message.displayProtocol === 'WorldMessage' && message.message?.[0]?.includes('left')) as any
        const arrive = published.find((message: any) => message.displayProtocol === 'WorldMessage' && message.message?.[0]?.includes('arrive')) as any
        const headers = published.filter((message: any) => message.displayProtocol === 'PerceptionMessage') as any[]

        expect(leave).toEqual(expect.objectContaining({ createdTime: BEAT, targets: [MOVER, OBSERVER] }))
        expect(arrive).toEqual(expect.objectContaining({ createdTime: BEAT + 2, targets: [MOVER] }))

        // Placeholder at its stamped place, terminal revising the same message strictly later.
        expect(headers).toHaveLength(2)
        expect(headers[0]).toEqual(expect.objectContaining({ createdTime: BEAT + 1, targets: [MOVER] }))
        expect(headers[0].metaData.status).toBe('generating')
        expect(headers[1].messageId).toBe(headers[0].messageId)
        expect(headers[1].createdTime).toBeGreaterThan(headers[0].createdTime)
        expect(headers[1].metaData.status).toBeUndefined()
        expect(headers[1].wmlContent).toContain('Arrival Hall')

        // Distinct MessageIds per transcript entry.
        expect(new Set([leave.messageId, headers[0].messageId, arrive.messageId]).size).toBe(3)
    })
})
