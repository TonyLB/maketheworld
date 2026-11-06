import { expectedTokens, parseJudgeReply, replyTokens, scoreJudge, scoreReply, scoreTriage } from './sceneReasoningScore'

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

    it('scores a triage reply by its last word if that is a label, else by its first word', () => {
        expect(scoreTriage('simple', 'simple')).toBe(true)
        expect(scoreTriage('impossible', 'A motorcycle does not fit in a shoebox.\n"Impossible."')).toBe(true)
        expect(scoreTriage('complex', '[complex]\n')).toBe(true)
        expect(scoreTriage('simple', 'complex')).toBe(false)
        expect(scoreTriage('simple', 'It is simple to do.')).toBe(false)
        expect(scoreTriage('impossible', 'Impossible: a table does not fit in a cup.')).toBe(true)
        expect(scoreTriage('impossible', 'impossible\nA table does not fit in a cup.')).toBe(true)
        expect(scoreTriage('impossible', 'The table is too big, preventing it from being moved. impossible\n')).toBe(true)
        expect(scoreTriage('complex', 'Simple on its face, but the glue matters.\ncomplex')).toBe(true)
        expect(scoreTriage(undefined, 'simple')).toBeUndefined()
    })
})

describe('parseJudgeReply', () => {
    const reply = ['Picture: The table is lifted.', 'Obstacle: nothing', 'Needs: nothing', 'Revises (if it happens): nothing', 'Answer: simple'].join('\n')

    it('reads the label after Answer, and the lines by name', () => {
        expect(parseJudgeReply(reply)).toEqual({ label: 'simple', lines: { picture: 'The table is lifted.', obstacle: 'nothing', needs: 'nothing', 'revises (if it happens)': 'nothing', answer: 'simple' } })
    })

    it('takes the rest of the Answer line as the sentence', () => {
        expect(parseJudgeReply('Answer: obstructed - [teapot1] is glued to [table1].')).toMatchObject({ label: 'obstructed', sentence: '[teapot1] is glued to [table1].' })
        expect(parseJudgeReply('5. **Answer:** "impossible" A table does not fit in a cup.')).toMatchObject({ label: 'impossible', sentence: 'A table does not fit in a cup.' })
        expect(parseJudgeReply('6. Answer: "obstructed"; The teapot is glued down.')).toMatchObject({ label: 'obstructed', sentence: 'The teapot is glued down.' })
    })

    it('has no label when there is no Answer line or its first word is no label', () => {
        expect(parseJudgeReply('The answer is simple.').label).toBeUndefined()
        expect(parseJudgeReply('Answer: It is simple.').label).toBeUndefined()
    })

    it('scores the label against the expected one, and leaves an absent expectation unscored', () => {
        expect(scoreJudge('simple', reply)).toBe(true)
        expect(scoreJudge('contingent', reply)).toBe(false)
        expect(scoreJudge(undefined, reply)).toBeUndefined()
    })
})
