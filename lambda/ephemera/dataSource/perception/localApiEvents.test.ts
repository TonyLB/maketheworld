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
})
