import { isCharacterMovedPublishedPayload, sendCharacterMovedPublish, streamEventFromMessageBus } from './publishedEvents'

describe('isCharacterMovedPublishedPayload', () => {
    const minimal = {
        type: 'Character Moved' as const,
        characterId: 'CHARACTER#test',
        from: 'ROOM#a' as const,
        to: 'ROOM#b' as const,
        beatAnchorTime: 1_700_000_000_000,
    }

    it('accepts a valid cross-room payload', () => {
        expect(isCharacterMovedPublishedPayload(minimal)).toBe(true)
    })

    it('accepts null endpoints for connect/disconnect', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, from: null, to: 'ROOM#b' })).toBe(true)
        expect(isCharacterMovedPublishedPayload({ ...minimal, from: 'ROOM#a', to: null })).toBe(true)
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

    it('rejects invalid endpoints or beatAnchorTime', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, from: 'not-a-room' })).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, to: 1 } as unknown)).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, beatAnchorTime: NaN })).toBe(false)
    })

    it('rejects invalid optional fields', () => {
        expect(isCharacterMovedPublishedPayload({ ...minimal, legalExits: ['north', 1] })).toBe(false)
        expect(isCharacterMovedPublishedPayload({ ...minimal, characterName: 1 } as unknown)).toBe(false)
    })
})

describe('streamEventFromMessageBus', () => {
    it('publishes StreamingEvent on the message bus', async () => {
        const bus = { publish: jest.fn() }
        const streamEvent = streamEventFromMessageBus(bus)
        const content = {
            type: 'Character Moved' as const,
            characterId: 'CHARACTER#test' as const,
            from: 'ROOM#a' as const,
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
})

describe('sendCharacterMovedPublish', () => {
    it('publishes a Character Moved StreamingEvent message', () => {
        const bus = { publish: jest.fn() }
        sendCharacterMovedPublish(bus, 'CHARACTER#test', {
            type: 'Character Moved',
            characterId: 'CHARACTER#test',
            from: 'ROOM#a',
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
