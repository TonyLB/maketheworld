import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

jest.mock('../../messageOrchestration/subscribedEvents', () => ({
    sendMessageBundleDeclared: jest.fn(),
    sendMessageSlotReported: jest.fn(),
}))

import { sendMessageBundleDeclared, sendMessageSlotReported } from '../../messageOrchestration/subscribedEvents'
import { deliverNarrationUnits } from './deliverNarrationUnits'
import type { NarrationUnit } from '../../actions/commandAttempt/narrationUnit'

const sendMessageBundleDeclaredMock = sendMessageBundleDeclared as jest.MockedFunction<typeof sendMessageBundleDeclared>
const sendMessageSlotReportedMock = sendMessageSlotReported as jest.MockedFunction<typeof sendMessageSlotReported>

const ALICE = 'CHARACTER#Alice' as EphemeraCharacterId
const BOB = 'CHARACTER#Bob' as EphemeraCharacterId

const unit = (ref: string): NarrationUnit => ({
    covers: ['action-1'],
    variants: [
        {
            audience: { refs: [ref], phase: 'before' },
            parts: [{ slot: 'actor' }, { text: ' picks up ' }, { ref }],
        },
        {
            audience: { refs: [ref], phase: 'after' },
            parts: [{ slot: 'actor' }, { text: ' picks up ' }, { ref }],
        },
    ],
})

describe('deliverNarrationUnits', () => {
    beforeEach(() => {
        jest.clearAllMocks()
    })

    it('does nothing for an empty unit list --- no bundle declared', () => {
        deliverNarrationUnits({
            units: [],
            captures: new Map(),
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus: {} as any,
            resolveCaptureId: () => { throw new Error('should not be called') },
        })

        expect(sendMessageBundleDeclaredMock).not.toHaveBeenCalled()
        expect(sendMessageSlotReportedMock).not.toHaveBeenCalled()
    })

    it('declares one slot per variant, then reports each slot filled with its own audience\'s roster', () => {
        const messageBus = { publish: jest.fn() } as any
        const captures = new Map([
            ['capture:from:ROOM#Departure', [ALICE]],
            ['capture:to', [BOB]],
        ])

        deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures,
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: (_unit, audience) => (audience.phase === 'before' ? ['capture:from:ROOM#Departure'] : ['capture:to']),
        })

        expect(sendMessageBundleDeclaredMock).toHaveBeenCalledTimes(1)
        const [, , declareContent] = sendMessageBundleDeclaredMock.mock.calls[0]!
        expect(declareContent.bundleId).toBe('BUNDLE#test')
        expect(declareContent.slots).toHaveLength(2)
        expect(declareContent.slots.every((slot) => slot.expectedPublishType === 'WorldMessage')).toBe(true)

        expect(sendMessageSlotReportedMock).toHaveBeenCalledTimes(2)
        const reported = sendMessageSlotReportedMock.mock.calls.map(([, , content]) => content)
        expect(reported[0]!.message).toMatchObject({ type: 'PublishMessage', displayProtocol: 'WorldMessage', targets: [ALICE], message: ['Alice picks up broom'] })
        expect(reported[1]!.message).toMatchObject({ type: 'PublishMessage', displayProtocol: 'WorldMessage', targets: [BOB], message: ['Alice picks up broom'] })
    })

    it('unions several capture ids into one deduplicated roster for a multi-room audience', () => {
        const messageBus = { publish: jest.fn() } as any
        const captures = new Map([
            ['capture:room-1', [ALICE]],
            ['capture:room-2', [ALICE, BOB]],
        ])

        deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures,
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: (_unit, audience) => (audience.phase === 'before' ? ['capture:room-1', 'capture:room-2'] : []),
        })

        const reported = sendMessageSlotReportedMock.mock.calls.map(([, , content]) => content)
        expect(reported[0]!.message).toMatchObject({ targets: [ALICE, BOB] })
        expect(reported[1]!.message).toMatchObject({ targets: [] })
    })

    it('throws the no-live-roster-fallback invariant when a resolved captureId has no entry', () => {
        expect(() => deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures: new Map(),
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:missing'],
        })).toThrow(/produced no capture for/)
    })

    it('throws when one of several resolved captureIds has no entry', () => {
        const captures = new Map([['capture:known', [ALICE]]])
        expect(() => deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures,
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:known', 'capture:missing'],
        })).toThrow(/produced no capture for/)
    })

    it('fills every variant from the caller\'s actor name and per-ref labels, not from the unit', () => {
        const captures = new Map([['capture:room', [ALICE]]])
        deliverNarrationUnits({
            units: [{
                covers: ['action-1'],
                variants: [{
                    audience: { refs: ['graphNode:OBJECT#Rope', 'graphNode:OBJECT#Post'], phase: 'before' },
                    parts: [{ slot: 'actor' }, { text: ' frees ' }, { ref: 'graphNode:OBJECT#Rope' }, { text: ' from ' }, { ref: 'graphNode:OBJECT#Post' }],
                }],
            }],
            captures,
            bundleId: 'BUNDLE#test',
            actorName: 'Tess',
            labels: { 'graphNode:OBJECT#Rope': 'rope', 'graphNode:OBJECT#Post': 'post' },
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:room'],
        })

        const reported = sendMessageSlotReportedMock.mock.calls.map(([, , content]) => content)
        expect(reported[0]!.message).toMatchObject({ targets: [ALICE], message: ['Tess frees rope from post'] })
    })

    it('throws when a variant refers to a ref the caller supplied no label for', () => {
        expect(() => deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures: new Map([['capture:room', [ALICE]]]),
            bundleId: 'BUNDLE#test',
            actorName: 'Alice',
            labels: {},
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:room'],
        })).toThrow(/has no label/)
    })
})
