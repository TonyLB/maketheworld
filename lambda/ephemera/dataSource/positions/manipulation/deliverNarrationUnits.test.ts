import type { EphemeraCharacterId } from '@tonylb/mtw-interfaces/ts/baseClasses'

import { deliverNarrationUnits } from './deliverNarrationUnits'
import type { NarrationUnit } from '../../actions/commandAttempt/narrationUnit'

const BEAT = 1_700_000_000_000

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

    it('does nothing for an empty unit list', () => {
        const messageBus = { publish: jest.fn() } as any
        deliverNarrationUnits({
            units: [],
            captures: new Map(),
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: () => { throw new Error('should not be called') },
        })

        expect(messageBus.publish).not.toHaveBeenCalled()
    })

    it('publishes one line per variant, each to its own audience\'s roster, directly on the bus', () => {
        const messageBus = { publish: jest.fn() } as any
        const captures = new Map([
            ['capture:from:ROOM#Departure', [ALICE]],
            ['capture:to', [BOB]],
        ])

        deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures,
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: (_unit, audience) => (audience.phase === 'before' ? ['capture:from:ROOM#Departure'] : ['capture:to']),
        })

        expect(messageBus.publish).toHaveBeenCalledTimes(2)
        const reported = messageBus.publish.mock.calls.map(([message]: any[]) => message)
        expect(reported[0]).toMatchObject({ type: 'PublishMessage', displayProtocol: 'WorldMessage', targets: [ALICE], message: ['Alice picks up broom'] })
        expect(reported[1]).toMatchObject({ type: 'PublishMessage', displayProtocol: 'WorldMessage', targets: [BOB], message: ['Alice picks up broom'] })
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
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: (_unit, audience) => (audience.phase === 'before' ? ['capture:room-1', 'capture:room-2'] : []),
        })

        const reported = messageBus.publish.mock.calls.map(([message]: any[]) => message)
        expect(reported[0]).toMatchObject({ targets: [ALICE, BOB] })
        expect(reported[1]).toMatchObject({ targets: [] })
    })

    it('throws the no-live-roster-fallback invariant when a resolved captureId has no entry', () => {
        expect(() => deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures: new Map(),
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
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
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:known', 'capture:missing'],
        })).toThrow(/produced no capture for/)
    })

    it('fills every variant from the caller\'s actor name and per-ref labels, not from the unit', () => {
        const captures = new Map([['capture:room', [ALICE]]])
        const messageBus = { publish: jest.fn() } as any
        deliverNarrationUnits({
            units: [{
                covers: ['action-1'],
                variants: [{
                    audience: { refs: ['graphNode:OBJECT#Rope', 'graphNode:OBJECT#Post'], phase: 'before' },
                    parts: [{ slot: 'actor' }, { text: ' frees ' }, { ref: 'graphNode:OBJECT#Rope' }, { text: ' from ' }, { ref: 'graphNode:OBJECT#Post' }],
                }],
            }],
            captures,
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Tess',
            labels: { 'graphNode:OBJECT#Rope': 'rope', 'graphNode:OBJECT#Post': 'post' },
            messageBus,
            resolveCaptureId: () => ['capture:room'],
        })

        const reported = messageBus.publish.mock.calls.map(([message]: any[]) => message)
        expect(reported[0]).toMatchObject({ targets: [ALICE], message: ['Tess frees rope from post'] })
    })

    it('throws when a variant refers to a ref the caller supplied no label for', () => {
        expect(() => deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures: new Map([['capture:room', [ALICE]]]),
            beatAnchorTime: BEAT,
            firstPresentationIndex: 0,
            actorName: 'Alice',
            labels: {},
            messageBus: { publish: jest.fn() } as any,
            resolveCaptureId: () => ['capture:room'],
        })).toThrow(/has no label/)
    })

    it('stamps each line at beatAnchorTime + firstPresentationIndex + n, each under its own MessageId', () => {
        const messageBus = { publish: jest.fn() } as any
        deliverNarrationUnits({
            units: [unit('OBJECT#Broom')],
            captures: new Map([['capture:room', [ALICE]]]),
            beatAnchorTime: BEAT,
            firstPresentationIndex: 3,
            actorName: 'Alice',
            labels: { 'OBJECT#Broom': 'broom' },
            messageBus,
            resolveCaptureId: () => ['capture:room'],
        })

        const [first, second] = messageBus.publish.mock.calls.map(([message]: any[]) => message)
        expect(first.createdTime).toBe(BEAT + 3)
        expect(second.createdTime).toBe(BEAT + 4)
        expect(first.messageId).toMatch(/^MESSAGE#/)
        expect(first.messageId).not.toEqual(second.messageId)
    })
})
