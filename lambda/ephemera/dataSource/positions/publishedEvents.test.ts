import type { EphemeraRoomId } from '@tonylb/mtw-interfaces/ts/baseClasses'
import { isCharacterMovedPublishedPayload, isObjectMovedPublishedPayload, sendCharacterMovedPublish, sendObjectMovedPublish, streamEventFromMessageBus } from './publishedEvents'

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
