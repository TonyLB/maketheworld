import { buildMembershipMoveOp } from './buildMembershipMoveOp'

describe('buildMembershipMoveOp', () => {
    it('connect: arriveCopyKind is "connect", froms is empty so leaveCopyKind is never exercised', () => {
        const op = buildMembershipMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: [],
            to: 'ROOM#alpha',
            bundleId: 'BUNDLE#test',
            intentKind: 'connect',
            headerSlot: null,
        })

        expect(op.narration?.arriveCopyKind).toEqual('connect')
        expect(op.froms).toEqual([])
    })

    it('disconnect: leaveCopyKind is "disconnect" regardless of exit/intent-from context, to is null so arriveCopyKind is never exercised', () => {
        const op = buildMembershipMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: null,
            bundleId: 'BUNDLE#test',
            intentKind: 'disconnect',
            intentFromRoomId: 'ROOM#somewhereElse',
            exitName: 'north',
            headerSlot: null,
        })

        expect(op.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('disconnect')
        expect(op.to).toBeNull()
    })

    it('navigate/home copy-kind selection is unchanged by the widened intentKind union', () => {
        const homeOp = buildMembershipMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: 'ROOM#home',
            bundleId: 'BUNDLE#test',
            intentKind: 'home',
            headerSlot: null,
        })
        expect(homeOp.narration?.arriveCopyKind).toEqual('home')
        expect(homeOp.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('home')

        const navigateOp = buildMembershipMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: 'ROOM#beta',
            bundleId: 'BUNDLE#test',
            intentKind: 'navigate',
            intentFromRoomId: 'ROOM#alpha',
            exitName: 'north',
            headerSlot: null,
        })
        expect(navigateOp.narration?.arriveCopyKind).toEqual('exitAware')
        expect(navigateOp.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('exitAware')
    })
})
