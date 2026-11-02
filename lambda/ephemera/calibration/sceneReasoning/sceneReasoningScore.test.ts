import { expectedTokens, replyTokens, scoreReply } from './sceneReasoningScore'

describe('sceneReasoningScore', () => {
    it('tokenises bracketed lists, bullets, trailing dots and none', () => {
        expect(replyTokens('[cup1], [Saucer1].')).toEqual(['cup1', 'saucer1'])
        expect(replyTokens('- [cup1]\n- [saucer1]')).toEqual(['cup1', 'saucer1'])
        expect(replyTokens('room')).toEqual(['room'])
        expect(replyTokens('none')).toEqual([])
    })

    it('canonicalises handles, locations, targets and counts', () => {
        expect(expectedTokens({ handles: ['a1'] })).toEqual({ kind: 'set', tokens: ['a1'] })
        expect(expectedTokens({ locations: [{ kind: 'room' }, { kind: 'thing', handle: 't1', hostingKind: 'On' }, { kind: 'held' }] }))
            .toEqual({ kind: 'set', tokens: ['room', 't1', 'held'] })
        expect(expectedTokens({ targets: [{ kind: 'thing', handle: 'p1' }] })).toEqual({ kind: 'set', tokens: ['p1'] })
        expect(expectedTokens({ count: 2 })).toEqual({ kind: 'count', count: 2 })
    })

    it('leaves locations and targets of other kinds unscored', () => {
        expect(expectedTokens({ locations: [{ kind: 'otherRoom' }] })).toBeUndefined()
        expect(expectedTokens({ targets: [{ kind: 'notShown' }] })).toBeUndefined()
        expect(scoreReply(undefined, '[a1]')).toBeUndefined()
    })

    it('matches sets regardless of order, and counts', () => {
        const expected = expectedTokens({ handles: ['a1', 'b1'] })
        expect(scoreReply(expected, '[b1], [a1]')).toBe(true)
        expect(scoreReply(expected, '[a1]')).toBe(false)
        expect(scoreReply(expected, '[a1], [b1], [c1]')).toBe(false)
        expect(scoreReply(expectedTokens({ handles: [] }), 'none')).toBe(true)
        expect(scoreReply({ kind: 'count', count: 2 }, '2')).toBe(true)
        expect(scoreReply({ kind: 'count', count: 2 }, 'There are three')).toBe(false)
    })
})
