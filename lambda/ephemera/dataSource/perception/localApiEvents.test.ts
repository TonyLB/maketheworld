import { isPerceptionThreadRegisterCommand } from './localApiEvents'

describe('isPerceptionThreadRegisterCommand', () => {
    it('accepts roomHeaderBroadcast with non-empty targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'roomHeaderBroadcast',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                targets: ['CHARACTER#a'],
            })
        ).toBe(true)
    })

    it('rejects roomHeaderBroadcast with empty targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'roomHeaderBroadcast',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                targets: [],
            })
        ).toBe(false)
    })

    it('rejects roomHeaderBroadcast with non-room componentId', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'roomHeaderBroadcast',
                componentId: 'FEATURE#x',
                perspectiveKey: 'pk',
                targets: ['CHARACTER#a'],
            })
        ).toBe(false)
    })

    it('accepts characterMove with required messageGroupId and optional header fields', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'characterMove',
                componentId: 'ROOM#dest',
                perspectiveKey: 'PERSPECTIVE#v1#x',
                characterId: 'CHARACTER#a',
                messageGroupId: 'root-id',
                messageId: 'MESSAGE#header',
                createdTime: 1_700_000_000_000,
            })
        ).toBe(true)
    })

    it('rejects characterMove when messageGroupId missing', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'characterMove',
                componentId: 'ROOM#dest',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
            } as unknown)
        ).toBe(false)
    })

    it('accepts sessionOrientationRender with CHARACTER# targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationRender',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
                targets: ['CHARACTER#a'],
            })
        ).toBe(true)
    })

    it('accepts sessionOrientationAffordances with CHARACTER# targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationAffordances',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
                targets: ['CHARACTER#a'],
            })
        ).toBe(true)
    })

    it('accepts sessionOrientationRender with SESSION# targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationRender',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
                targets: ['SESSION#session-1'],
            })
        ).toBe(true)
    })

    it('accepts sessionOrientationAffordances with SESSION# targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationAffordances',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
                targets: ['SESSION#session-1'],
            })
        ).toBe(true)
    })

    it('rejects sessionOrientationRender with empty targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationRender',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                characterId: 'CHARACTER#a',
                targets: [],
            })
        ).toBe(false)
    })

    it('rejects sessionOrientationAffordances without characterId', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationAffordances',
                componentId: 'ROOM#r1',
                perspectiveKey: 'pk',
                targets: ['SESSION#session-1'],
            })
        ).toBe(false)
    })
})
