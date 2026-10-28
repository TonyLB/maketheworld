import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isCharacterMovedPublishedPayload, isLudicCacheInvalidatedPublishedPayload, isEphemeraPositionsLudicCacheInvalidatedEnvelope, sendLudicCacheInvalidatedPublish, isEphemeraPositionsCharacterMovedEnvelope, isEphemeraPositionsOutboundEnvelope, isObjectMovedPublishedPayload, isObjectRelationChangedPublishedPayload, sendCharacterMovedPublish, sendObjectMovedPublish, streamEventFromMessageBus } from './publishedEvents'

describe('isCharacterMovedPublishedPayload', () => {
    const minimal = {
        type: 'Character Moved' as const,
        characterId: 'CHARACTER#test',
        froms: ['ROOM#a' as const],
        to: 'ROOM#b' as const,
        beatAnchorTime: 1_700_000_000_000,
    }

    it('accepts a valid cross-room payload', () => {
        expect(isCharacterMovedPublishedPayload(minimal)).toBe(true)
    })

    it('accepts empty froms or null to for connect/disconnect', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, froms: [], to: 'ROOM#b' })).toBe(true)
        expect(isCharacterMovedPublishedPayload({ ...minimal, froms: ['ROOM#a'], to: null })).toBe(true)
    })

    it('accepts optional legalExits and characterName', () => {
        expect(
            isCharacterMovedPublishedPayload({
                ...minimal,
                legalExits: ['north', 'south'],
                characterName: 'Alice',
            })
        ).toBe(true)
    })

    it('rejects wrong or missing type', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, type: 'Character Navigate' })).toBe(false)
        const { type: _t, ...rest } = minimal
        expect(isCharacterMovedPublishedPayload(rest)).toBe(false)
    })

    it('rejects legacy singular from field', () => {
        expect(isCharacterMovedPublishedPayload({
            type: 'Character Moved',
            characterId: 'CHARACTER#test',
            from: 'ROOM#a',
            to: 'ROOM#b',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(false)
    })

    it('rejects invalid froms, to, or beatAnchorTime', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, froms: ['not-a-room'] })).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, froms: 'ROOM#a' } as unknown)).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, to: 1 } as unknown)).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, beatAnchorTime: NaN })).toBe(false)
    })

    it('rejects invalid optional fields', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, legalExits: ['north', 1] })).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, characterName: 1 } as unknown)).toBe(false)
    })
})

describe('isObjectMovedPublishedPayload', () => {
    const minimal = {
        type: 'Object Moved' as const,
        objectId: 'OBJECT#skates',
        froms: ['ROOM#a' as const],
        to: 'ROOM#b' as const,
        beatAnchorTime: 1_700_000_000_000,
    }

    it('accepts a valid cross-room payload', () => {
        expect(isObjectMovedPublishedPayload(minimal)).toBe(true)
    })

    it('accepts room-to-character membership host endpoints (D8)', () => {
        expect(isObjectMovedPublishedPayload({
            type: 'Object Moved',
            objectId: 'OBJECT#broom',
            froms: ['ROOM#cafe'],
            to: 'CHARACTER#alpha',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(true)
    })

    it('accepts object and feature membership host endpoints', () => {
        expect(isObjectMovedPublishedPayload({
            type: 'Object Moved',
            objectId: 'OBJECT#spring',
            froms: ['OBJECT#Box'],
            to: 'FEATURE#Wall',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(true)
    })

    it('rejects invalid membership host ids', () => {
        expect(isObjectMovedPublishedPayload({
            ...minimal,
            froms: ['ASSET#invalid'],
        })).toBe(false)
        expect(isObjectMovedPublishedPayload({
            ...minimal,
            to: 'KNOWLEDGE#invalid',
        })).toBe(false)
    })

    it('rejects legacy singular from field', () => {
        expect(isObjectMovedPublishedPayload({
            type: 'Object Moved',
            objectId: 'OBJECT#skates',
            from: 'ROOM#a',
            to: 'ROOM#b',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(false)
    })
})

describe('isObjectRelationChangedPublishedPayload', () => {
    // This guard's RELATION_INSTRUCTION_KINDS Set (this file) has its own copy of the
    // persistence-lane widening -- a stale Set here fails silently rather than at compile time,
    // so a kernel-emitted containment fact must be checked to actually validate on publish.
    // Direction corrected 2026-08-20: the member is the subject ("the crystal ball is in
    // the kitchen"), the host is the target. hostId is the graph's owner and is unaffected.
    it.each(['In', 'PartOf'] as const)('accepts a %s containment relationKind', (relationKind) => {
        expect(isObjectRelationChangedPublishedPayload({
            type: 'Object Relation Changed',
            subjectId: 'OBJECT#crystalBall',
            targetId: 'ROOM#Kitchen',
            hostId: 'ROOM#Kitchen',
            relationKind,
            operation: 'establish',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(true)
    })

    // `'Present'` retired from `HostRelationalEdgeKind` entirely at presenceNodes Slice 3
    // (PN-14) -- this guard's RELATION_INSTRUCTION_KINDS Set (this file) dropped it in the same
    // change, and no writer ever constructed this payload shape (checked as part of PN-14's
    // standing check: no consumer outside lambda/ephemera/dataSource enumerates this kind).
    it('rejects a Present relationKind', () => {
        expect(isObjectRelationChangedPublishedPayload({
            type: 'Object Relation Changed',
            subjectId: 'OBJECT#crystalBall',
            targetId: 'ROOM#Kitchen',
            hostId: 'ROOM#Kitchen',
            relationKind: 'Present',
            operation: 'establish',
            beatAnchorTime: 1_700_000_000_000,
        })).toBe(false)
    })
})

describe('streamEventFromMessageBus', () => {
    it('publishes StreamingEvent on the message bus', async () => {
        const bus = { publish: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content = {
            type: 'Character Moved' as const,
            characterId: 'CHARACTER#test' as const,
            froms: ['ROOM#a' as const],
            to: 'ROOM#b' as const,
            beatAnchorTime: 1_700_000_000_000,
        }

        await streamEvent({
            streamKey: 'CHARACTER#test',
            header: { type: 'Character Moved' },
            update: content,
        })

        expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'StreamingEvent',
            dataSourceKey: 'mtw.ephemera.positions',
            streamKey: 'CHARACTER#test',
            header: expect.objectContaining({
                dataSourceKey: 'mtw.ephemera.positions',
                type: 'Character Moved',
            }),
        }))
    })

    it('publishes Object Moved on the message bus', async () => {
        const bus = { publish: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content = {
            type: 'Object Moved' as const,
            objectId: 'OBJECT#skates' as const,
            froms: [] as EphemeraRoomId[],
            to: 'ROOM#b' as const,
            beatAnchorTime: 1_700_000_000_000,
        }

        await streamEvent({
            streamKey: 'OBJECT#skates',
            header: { type: 'Object Moved' },
            update: content,
        })

        expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'StreamingEvent',
            streamKey: 'OBJECT#skates',
            header: expect.objectContaining({
                type: 'Object Moved',
            }),
        }))
    })
})

describe('sendCharacterMovedPublish', () => {
    it('publishes a Character Moved StreamingEvent message', () => {
        const bus = { publish: jest.fn() }
        sendCharacterMovedPublish(bus, 'CHARACTER#test', {
            type: 'Character Moved',
            characterId: 'CHARACTER#test',
            froms: ['ROOM#a'],
            to: 'ROOM#b',
            beatAnchorTime: 1_700_000_000_000,
        })

        expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'StreamingEvent',
            dataSourceKey: 'mtw.ephemera.positions',
            streamKey: 'CHARACTER#test',
        }))
    })
})

describe('sendObjectMovedPublish', () => {
    it('publishes an Object Moved StreamingEvent message', () => {
        const bus = { publish: jest.fn() }
        sendObjectMovedPublish(bus, 'OBJECT#skates', {
            type: 'Object Moved',
            objectId: 'OBJECT#skates',
            froms: [],
            to: 'ROOM#b',
            beatAnchorTime: 1_700_000_000_000,
        })

        expect(bus.publish).toHaveBeenCalledWith(expect.objectContaining({
            type: 'StreamingEvent',
            streamKey: 'OBJECT#skates',
            header: expect.objectContaining({
                type: 'Object Moved',
            }),
        }))
    })
})

describe('isEphemeraPositionsCharacterMovedEnvelope', () => {
    const envelopeFor = (dataSourceKey: string, type: string) => ({
        header: { dataSourceKey, streamKey: 'CHARACTER#test', timestamp: 1, type },
        getContent: async () => ({}),
    })

    it('accepts positions Character Moved', () => {
        expect(isEphemeraPositionsCharacterMovedEnvelope(envelopeFor('mtw.ephemera.positions', 'Character Moved'))).toBe(true)
        expect(isEphemeraPositionsOutboundEnvelope(envelopeFor('mtw.ephemera.positions', 'Character Moved'))).toBe(true)
    })

    it('rejects other positions facts and other DataSources', () => {
        expect(isEphemeraPositionsCharacterMovedEnvelope(envelopeFor('mtw.ephemera.positions', 'Object Moved'))).toBe(false)
        expect(isEphemeraPositionsCharacterMovedEnvelope(envelopeFor('mtw.ephemera.actions', 'Character Moved'))).toBe(false)
    })
})

describe('Ludic Cache Invalidated', () => {
    it('accepts a payload naming one or more rooms and rejects anything else', () => {
        expect(isLudicCacheInvalidatedPublishedPayload({ type: 'Ludic Cache Invalidated', roomIds: ['ROOM#a', 'ROOM#b'] })).toBe(true)
        expect(isLudicCacheInvalidatedPublishedPayload({ type: 'Ludic Cache Invalidated', roomIds: [] })).toBe(false)
        expect(isLudicCacheInvalidatedPublishedPayload({ type: 'Ludic Cache Invalidated', roomIds: ['OBJECT#cup'] })).toBe(false)
        expect(isLudicCacheInvalidatedPublishedPayload({ type: 'Object Moved', roomIds: ['ROOM#a'] })).toBe(false)
    })

    it('publishes a StreamingEvent that the outbound envelope guards recognize', async () => {
        const publish = jest.fn()
        await streamEventFromMessageBus({ publish } as any)({
            update: { type: 'Ludic Cache Invalidated', roomIds: ['ROOM#a' as EphemeraRoomId] },
            streamKey: 'ROOM#a',
            header: { type: 'Ludic Cache Invalidated' },
        })
        expect(publish).toHaveBeenCalledTimes(1)
        const message = publish.mock.calls[0][0]
        expect(message).toMatchObject({ type: 'StreamingEvent', dataSourceKey: 'mtw.ephemera.positions', streamKey: 'ROOM#a' })
        expect(isEphemeraPositionsLudicCacheInvalidatedEnvelope(message)).toBe(true)
        expect(isEphemeraPositionsOutboundEnvelope(message)).toBe(true)
        await expect(message.getContent()).resolves.toEqual({ type: 'Ludic Cache Invalidated', roomIds: ['ROOM#a'] })
    })
})
