import { buildCharacterMoveOp } from './buildCharacterMoveOp'

describe('buildCharacterMoveOp', () => {
    it('connect: arriveCopyKind is "connect", froms is empty so leaveCopyKind is never exercised', () => {
        const op = buildCharacterMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: [],
            to: 'ROOM#alpha',
            intentKind: 'connect',
            header: null,
        })

        expect(op.narration?.arriveCopyKind).toEqual('connect')
        expect(op.froms).toEqual([])
    })

    it('disconnect: leaveCopyKind is "disconnect" regardless of exit/intent-from context, to is null so arriveCopyKind is never exercised', () => {
        const op = buildCharacterMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: null,
            intentKind: 'disconnect',
            intentFromRoomId: 'ROOM#somewhereElse',
            exitName: 'north',
            header: null,
        })

        expect(op.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('disconnect')
        expect(op.to).toBeNull()
    })

    it('navigate/home copy-kind selection is unchanged by the widened intentKind union', () => {
        const homeOp = buildCharacterMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: 'ROOM#home',
            intentKind: 'home',
            header: null,
        })
        expect(homeOp.narration?.arriveCopyKind).toEqual('home')
        expect(homeOp.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('home')

        const navigateOp = buildCharacterMoveOp({
            characterId: 'CHARACTER#Test',
            characterName: 'Tess',
            froms: ['ROOM#alpha'],
            to: 'ROOM#beta',
            intentKind: 'navigate',
            intentFromRoomId: 'ROOM#alpha',
            exitName: 'north',
            header: null,
        })
        expect(navigateOp.narration?.arriveCopyKind).toEqual('exitAware')
        expect(navigateOp.narration?.leaveCopyKind('ROOM#alpha' as any)).toEqual('exitAware')
    })
})
