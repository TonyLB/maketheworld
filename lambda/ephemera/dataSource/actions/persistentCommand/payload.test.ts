import { isPersistentCommandPayload } from './payload'
import { takeCupPayload } from './testFixtures'

describe('isPersistentCommandPayload', () => {
    it('accepts a payload built from a real plan', () => {
        expect(isPersistentCommandPayload(takeCupPayload())).toBe(true)
    })

    it('accepts a payload with no selected attempt and no answers', () => {
        const { selectedAttempt, ...rest } = takeCupPayload()
        expect(isPersistentCommandPayload({ ...rest, referentAnswers: {}, challengeAnswers: {} })).toBe(true)
    })

    it.each<[string, (payload: any) => any]>([
        ['a non-object', () => 'nope'],
        ['a missing root', ({ root, ...rest }) => rest],
        ['a root without a command', ({ root, ...rest }) => ({ ...rest, root: { ...root, command: 5 } })],
        ['a malformed skeleton token', ({ root, ...rest }) => ({ ...rest, root: { ...root, skeleton: [{ type: 'objectSpan', span: 'cup' }] } })],
        ['a malformed attempt', ({ root, ...rest }) => ({ ...rest, root: { ...root, attempts: [{ words: 'x' }] } })],
        ['a non-numeric confidence', ({ root, ...rest }) => ({ ...rest, root: { ...root, confidence: 'high' } })],
        ['a non-string selectedAttempt', (payload) => ({ ...payload, selectedAttempt: 3 })],
        ['a non-string referent answer', (payload) => ({ ...payload, referentAnswers: { a: 3 } })],
        ['a missing challengeAnswers', ({ challengeAnswers, ...rest }) => rest],
        ['an answer with an unknown source', (payload) => ({ ...payload, challengeAnswers: { a: { verdict: { kind: 'met' }, source: 'oracle' } } })],
        ['an answer with a malformed verdict', (payload) => ({ ...payload, challengeAnswers: { a: { verdict: { kind: 'impossible' }, source: 'player' } } })],
    ])('rejects %s', (_label, corrupt) => {
        expect(isPersistentCommandPayload(corrupt(takeCupPayload()))).toBe(false)
    })
})
