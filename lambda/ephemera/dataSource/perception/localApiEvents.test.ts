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

    it('rejects sessionOrientationAffordances with empty targets', () => {
        expect(
            isPerceptionThreadRegisterCommand({
                threadKind: 'sessionOrientationAffordances',
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

    // Phase 7: roomDescription/featureDescription/knowledgeDescription/objectDescription/
    // sessionOrientationRender retreated off PerceptionThreads entirely --- they now register
    // against messageOrchestration's ingress registry instead (contentIngress.ts), so this guard
    // must reject them, not accept them.
    it.each(['roomDescription', 'featureDescription', 'knowledgeDescription', 'objectDescription', 'sessionOrientationRender'])(
        'rejects the retreated %s threadKind',
        (threadKind) => {
            expect(
                isPerceptionThreadRegisterCommand({
                    threadKind,
                    componentId: 'ROOM#r1',
                    perspectiveKey: 'pk',
                    characterId: 'CHARACTER#a',
                    targets: ['CHARACTER#a'],
                })
            ).toBe(false)
        }
    )
})
